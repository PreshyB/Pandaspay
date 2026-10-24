import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute } from './entities/dispute.entity';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';

@Module({
  imports: [TypeOrmModule.forFeature([Dispute]), PaymentsModule, PaymentProvidersModule],
  providers: [DisputesService],
  controllers: [DisputesController],
  exports: [TypeOrmModule],
})
export class DisputesModule {}
