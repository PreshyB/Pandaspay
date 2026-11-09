import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/product.entity';
import { ProductSku } from '../products/product-sku.entity';
import { isValidOrderTransition, OrderStatus } from '../common/enums/order-status.enum';
import { PaymentProtectionStatus } from '../common/enums/payment-protection-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentsService } from '../payments/payments.service';
import { Payment } from '../payments/entities/payment.entity';
import { DeliveryOption, DeliveryZone } from '../delivery/delivery-option.entity';
import { sameState } from '../delivery/delivery.service';
import { User } from '../users/user.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(ProductSku) private readonly skus: Repository<ProductSku>,
    @InjectRepository(DeliveryOption) private readonly deliveryOptions: Repository<DeliveryOption>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly paymentsService: PaymentsService,
  ) {}

  async findById(orderId: string): Promise<Order> {
    return this.orders.findOneOrFail({ where: { id: orderId }, relations: ['items', 'payment'] });
  }

  async findForBuyer(buyerId: string): Promise<Order[]> {
    return this.orders.find({ where: { buyerId }, relations: ['items', 'payment'], order: { createdAt: 'DESC' } });
  }

  async findForSeller(sellerId: string): Promise<Order[]> {
    return this.orders.find({ where: { sellerId }, relations: ['items', 'payment'], order: { createdAt: 'DESC' } });
  }

  /** Buyer places an order. Order starts at CREATED; a Payment row starts at AWAITING_PAYMENT. */
  async createOrder(dto: CreateOrderDto) {
    const currency = dto.currency ?? 'NGN';
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.products.findByIds(productIds);
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products were not found');
    }

    if (products.some((p) => p.sellerId !== dto.sellerId)) {
      throw new BadRequestException('All items in one order must come from the same seller');
    }

    let totalMinor = BigInt(0);
    const items = dto.items.map((itemDto) => {
      const product = products.find((p) => p.id === itemDto.productId)!;
      if (!Number.isInteger(itemDto.quantity) || itemDto.quantity < 1) {
        throw new BadRequestException('Quantity must be a whole number of at least 1');
      }
      // The server, not the browser, decides which choices are valid.
      for (const option of product.options ?? []) {
        const chosen = itemDto.variant?.[option.name];
        if (typeof chosen !== 'string' || !option.values.includes(chosen)) {
          throw new BadRequestException(`Please choose a valid ${option.name} for "${product.title}"`);
        }
      }
      // Stock lives on the exact combination (colour + size...), not on the product as a whole.
      let sku: ProductSku | undefined;
      if (product.skus?.length) {
        sku = product.skus.find((s) => (product.options ?? []).every((o) => s.attributes?.[o.name] === itemDto.variant?.[o.name]));
        if (!sku) throw new BadRequestException(`That combination of "${product.title}" is not available`);
        if (sku.stockQuantity < itemDto.quantity) {
          throw new BadRequestException(
            sku.stockQuantity > 0
              ? `Only ${sku.stockQuantity} left of that choice of "${product.title}"`
              : `That choice of "${product.title}" is out of stock`,
          );
        }
      }
      const lineTotal = BigInt(product.priceMinor) * BigInt(itemDto.quantity);
      totalMinor += lineTotal;
      return this.orderItems.create({
        productId: product.id,
        quantity: itemDto.quantity,
        unitPriceMinor: product.priceMinor,
        skuId: sku?.id,
        variant: itemDto.variant,
      });
    });

    // Delivery: the server picks the fee and window from the seller's own option and
    // checks it fits the buyer's address. The browser never supplies the amount.
    let deliveryFee = BigInt(0);
    let deliveryOption: Order['deliveryOption'];
    if (dto.deliveryOptionId) {
      const option = await this.deliveryOptions.findOneBy({ id: dto.deliveryOptionId });
      if (!option || option.sellerId !== dto.sellerId) {
        throw new BadRequestException('That delivery option is not available from this seller');
      }
      if (!option.isActive) throw new BadRequestException('That delivery option is paused by the seller');
      const seller = await this.users.findOneBy({ id: dto.sellerId });
      const buyerState = typeof dto.deliveryAddress?.state === 'string' ? dto.deliveryAddress.state : undefined;
      const within = sameState(buyerState, seller?.storeState);
      if ((option.zone === DeliveryZone.WITHIN_STATE) !== within) {
        throw new BadRequestException('That delivery option does not cover your delivery address');
      }
      deliveryFee = BigInt(option.feeMinor);
      totalMinor += deliveryFee;
      deliveryOption = {
        zone: option.zone,
        speed: option.speed,
        feeMinor: option.feeMinor,
        minHours: option.minHours,
        maxHours: option.maxHours,
      };
    }

    const order = this.orders.create({
      deliveryFeeMinor: deliveryFee.toString(),
      deliveryOption,
      buyerId: dto.buyerId,
      sellerId: dto.sellerId,
      items,
      status: OrderStatus.CREATED,
      totalMinor: totalMinor.toString(),
      currency,
      deliveryAddress: dto.deliveryAddress,
    });
    // Reserve stock atomically. If anything later fails, give it back.
    const reserved = await this.reserveStock(items);
    try {
      await this.orders.save(order);
      const { payment, paymentInstruction } = await this.paymentsService.initiateForOrder({
        orderId: order.id,
        amountMinor: order.totalMinor,
        currency,
        buyerReference: dto.buyerId,
      });
      return { order, payment, paymentInstruction };
    } catch (err) {
      await this.releaseStock(reserved);
      throw err;
    }
  }

  /** Takes stock from each line's SKU, never below zero (single conditional UPDATE per line). */
  private async reserveStock(items: OrderItem[]): Promise<OrderItem[]> {
    const reserved: OrderItem[] = [];
    try {
      for (const item of items) {
        if (!item.skuId) continue;
        const res = await this.skus
          .createQueryBuilder()
          .update(ProductSku)
          .set({ stockQuantity: () => `"stockQuantity" - ${Number(item.quantity)}` })
          .where('id = :id AND "stockQuantity" >= :q', { id: item.skuId, q: item.quantity })
          .execute();
        if (!res.affected) throw new BadRequestException('Someone just bought the last of that choice. Please adjust your quantity.');
        reserved.push(item);
      }
    } catch (err) {
      await this.releaseStock(reserved);
      throw err;
    }
    return reserved;
  }

  private async releaseStock(items: Array<{ skuId?: string; quantity: number }>) {
    for (const item of items) {
      if (!item.skuId) continue;
      await this.skus
        .createQueryBuilder()
        .update(ProductSku)
        .set({ stockQuantity: () => `"stockQuantity" + ${Number(item.quantity)}` })
        .where('id = :id', { id: item.skuId })
        .execute();
    }
  }

  /**
   * CREATED -> PREPARING. "Requires payment track to already be at
   * PROTECTED or beyond AWAITING_PAYMENT — a seller cannot accept an
   * unpaid order." (spec §2.2)
   */
  async sellerAccept(orderId: string): Promise<Order> {
    const order = await this.orders.findOneByOrFail({ id: orderId });
    const payment = await this.payments.findOneByOrFail({ orderId });

    if (payment.protectionStatus === PaymentProtectionStatus.AWAITING_PAYMENT) {
      throw new BadRequestException('Cannot accept an order whose payment is not yet confirmed');
    }

    this.assertOrderTransition(order.status, OrderStatus.PREPARING);
    order.status = OrderStatus.PREPARING;
    return this.orders.save(order);
  }

  /**
   * CREATED -> CANCELLED. "Must atomically request a refund on the payment
   * track ... No order may sit at CANCELLED while payment remains
   * PROTECTED." (spec §2.2)
   */
  async declineOrCancel(orderId: string, actor: 'SELLER' | 'BUYER', actorId: string): Promise<Order> {
    const order = await this.orders.findOneByOrFail({ id: orderId });
    const payment = await this.payments.findOneByOrFail({ orderId });

    this.assertOrderTransition(order.status, OrderStatus.CANCELLED);
    order.status = OrderStatus.CANCELLED;
    await this.orders.save(order);
    // A cancelled order no longer needs its reserved stock.
    await this.releaseStock(await this.orderItems.findBy({ orderId }));

    if (payment.protectionStatus === PaymentProtectionStatus.PROTECTED) {
      await this.paymentsService.approveRefundForCancellation(payment.id, actor, actorId);
    }
    // If payment never got past AWAITING_PAYMENT, there is nothing to refund.

    return order;
  }

  /** PREPARING -> SHIPPED. */
  async markShipped(orderId: string, waybillRef: string): Promise<Order> {
    const order = await this.orders.findOneByOrFail({ id: orderId });
    this.assertOrderTransition(order.status, OrderStatus.SHIPPED);
    order.status = OrderStatus.SHIPPED;
    order.shippedAt = new Date();
    if (order.deliveryOption) {
      order.expectedDeliveryBy = new Date(order.shippedAt.getTime() + order.deliveryOption.maxHours * 60 * 60 * 1000);
    }
    order.deliveryAddress = { ...(order.deliveryAddress ?? {}), waybillRef };
    return this.orders.save(order);
  }

  /** SHIPPED -> IN_TRANSIT. Optional — orders without live tracking skip straight to DELIVERED. */
  async markInTransit(orderId: string): Promise<Order> {
    const order = await this.orders.findOneByOrFail({ id: orderId });
    this.assertOrderTransition(order.status, OrderStatus.IN_TRANSIT);
    order.status = OrderStatus.IN_TRANSIT;
    return this.orders.save(order);
  }

  /**
   * SHIPPED/IN_TRANSIT -> DELIVERED. "The single most important trigger in
   * the whole system — it starts the protection countdown (PROTECTED ->
   * RELEASABLE) on the payment track." (spec §2.2) Must log which of the
   * three sources fired it.
   */
  async confirmDelivered(orderId: string, confirmedBy: 'BUYER' | 'COURIER' | 'AUTO_TIMEOUT'): Promise<Order> {
    const order = await this.orders.findOneByOrFail({ id: orderId });
    this.assertOrderTransition(order.status, OrderStatus.DELIVERED);
    order.status = OrderStatus.DELIVERED;
    order.deliveredAt = new Date();
    order.deliveryConfirmedBy = confirmedBy;
    await this.orders.save(order);

    // Does not itself move the payment to RELEASABLE yet — the protection
    // window must also elapse with no open dispute. The settlement
    // scheduler sweeps DELIVERED orders whose window has passed. For the
    // mock/dev flow we also expose this directly so the window can be
    // tested without waiting PROTECTION_WINDOW_HOURS in real time.
    return order;
  }

  /** SHIPPED/IN_TRANSIT -> DELIVERY_FAILED. Does not touch the payment track by itself. */
  async markDeliveryFailed(orderId: string): Promise<Order> {
    const order = await this.orders.findOneByOrFail({ id: orderId });
    this.assertOrderTransition(order.status, OrderStatus.DELIVERY_FAILED);
    order.status = OrderStatus.DELIVERY_FAILED;
    return this.orders.save(order);
  }

  /** DELIVERY_FAILED -> IN_TRANSIT. Re-attempt loop; cap per business policy. */
  async scheduleReattempt(orderId: string): Promise<Order> {
    const order = await this.orders.findOneByOrFail({ id: orderId });
    this.assertOrderTransition(order.status, OrderStatus.IN_TRANSIT);
    order.status = OrderStatus.IN_TRANSIT;
    return this.orders.save(order);
  }

  /** DELIVERY_FAILED -> RETURNED. Should trigger a refund decision on the payment track. */
  async markReturned(orderId: string): Promise<Order> {
    const order = await this.orders.findOneByOrFail({ id: orderId });
    this.assertOrderTransition(order.status, OrderStatus.RETURNED);
    order.status = OrderStatus.RETURNED;
    return this.orders.save(order);
  }

  private assertOrderTransition(from: OrderStatus, to: OrderStatus) {
    if (!isValidOrderTransition(from, to)) {
      throw new BadRequestException(`Invalid order-status transition: ${from} -> ${to}`);
    }
  }
}
