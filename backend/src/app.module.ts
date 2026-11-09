import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { DeliveryModule } from './delivery/delivery.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PaymentProvidersModule } from './payment-providers/payment-providers.module';
import { DisputesModule } from './disputes/disputes.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SettlementModule } from './settlement/settlement.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    UsersModule,
    ProductsModule,
    DeliveryModule,
    OrdersModule,
    PaymentsModule,
    PaymentProvidersModule,
    DisputesModule,
    WebhooksModule,
    SettlementModule,
  ],
})
export class AppModule {}
