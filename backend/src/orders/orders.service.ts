import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/product.entity';
import { isValidOrderTransition, OrderStatus } from '../common/enums/order-status.enum';
import { PaymentProtectionStatus } from '../common/enums/payment-protection-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentsService } from '../payments/payments.service';
import { Payment } from '../payments/entities/payment.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
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

    let totalMinor = BigInt(0);
    const items = dto.items.map((itemDto) => {
      const product = products.find((p) => p.id === itemDto.productId)!;
      const lineTotal = BigInt(product.priceMinor) * BigInt(itemDto.quantity);
      totalMinor += lineTotal;
      return this.orderItems.create({
        productId: product.id,
        quantity: itemDto.quantity,
        unitPriceMinor: product.priceMinor,
        variant: itemDto.variant,
      });
    });

    const order = this.orders.create({
      buyerId: dto.buyerId,
      sellerId: dto.sellerId,
      items,
      status: OrderStatus.CREATED,
      totalMinor: totalMinor.toString(),
      currency,
      deliveryAddress: dto.deliveryAddress,
    });
    await this.orders.save(order);

    const { payment, paymentInstruction } = await this.paymentsService.initiateForOrder({
      orderId: order.id,
      amountMinor: order.totalMinor,
      currency,
      buyerReference: dto.buyerId,
    });

    return { order, payment, paymentInstruction };
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
