import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentEvent } from './entities/payment-event.entity';
import { Settlement } from './entities/settlement.entity';
import { IdempotencyKeyRecord } from './entities/idempotency-key.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { DispositionLockService } from './disposition-lock.service';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentEvent, Settlement, IdempotencyKeyRecord]),
    PaymentProvidersModule,
  ],
  providers: [PaymentsService, DispositionLockService],
  controllers: [PaymentsController],
  exports: [PaymentsService, DispositionLockService, TypeOrmModule],
})
export class PaymentsModule {}
