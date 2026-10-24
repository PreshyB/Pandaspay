import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { SettlementScheduler } from './settlement.scheduler';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Payment]), PaymentsModule],
  providers: [SettlementScheduler],
})
export class SettlementModule {}
