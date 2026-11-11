import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from '../payments/payments.module';
import { PayoutAccount, PayoutRequest } from './payout.entities';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [TypeOrmModule.forFeature([PayoutAccount, PayoutRequest]), PaymentsModule],
  providers: [PayoutsService],
  controllers: [PayoutsController],
})
export class PayoutsModule {}
