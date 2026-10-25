import { Controller, Get, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentEvent } from './entities/payment-event.entity';

@Controller('payments')
export class PaymentsController {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(PaymentEvent) private readonly paymentEvents: Repository<PaymentEvent>,
  ) {}

  @Get('by-order/:orderId')
  getByOrder(@Param('orderId') orderId: string) {
    return this.payments.findOneByOrFail({ orderId });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.payments.findOneByOrFail({ id });
  }

  @Get(':id/events')
  getEvents(@Param('id') id: string) {
    return this.paymentEvents.find({ where: { paymentId: id }, order: { createdAt: 'ASC' } });
  }
}
