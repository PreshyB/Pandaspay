import { Controller, ForbiddenException, Get, Param } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser, CurrentUser, isAdmin } from '../auth/authz';
import { Order } from '../orders/entities/order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentEvent } from './entities/payment-event.entity';

@Controller('payments')
export class PaymentsController {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(PaymentEvent) private readonly paymentEvents: Repository<PaymentEvent>,
    private readonly dataSource: DataSource,
  ) {}

  /** Payments are visible to the buyer, the seller and admins only. */
  private async assertParty(orderId: string, user?: AuthUser) {
    if (!user || isAdmin(user)) return;
    const order = await this.dataSource.getRepository(Order).findOneByOrFail({ id: orderId });
    if (order.buyerId !== user.id && order.sellerId !== user.id) {
      throw new ForbiddenException('That payment does not belong to your account.');
    }
  }

  @Get('by-order/:orderId')
  async getByOrder(@Param('orderId') orderId: string, @CurrentUser() user?: AuthUser) {
    await this.assertParty(orderId, user);
    return this.payments.findOneByOrFail({ orderId });
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    const payment = await this.payments.findOneByOrFail({ id });
    await this.assertParty(payment.orderId, user);
    return payment;
  }

  @Get(':id/events')
  async getEvents(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    const payment = await this.payments.findOneByOrFail({ id });
    await this.assertParty(payment.orderId, user);
    return this.paymentEvents.find({ where: { paymentId: id }, order: { createdAt: 'ASC' } });
  }
}
