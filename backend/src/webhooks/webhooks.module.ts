import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderWebhookEvent } from './entities/provider-webhook-event.entity';
import { WebhooksController } from './webhooks.controller';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProviderWebhookEvent]), PaymentsModule, PaymentProvidersModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
