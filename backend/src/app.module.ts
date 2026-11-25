import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { RateLimitGuard } from './common/rate-limit';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { SellersModule } from './sellers/sellers.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { DeliveryModule } from './delivery/delivery.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PaymentProvidersModule } from './payment-providers/payment-providers.module';
import { DisputesModule } from './disputes/disputes.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PayoutsModule } from './payouts/payouts.module';
import { SettlementModule } from './settlement/settlement.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditModule,
    AuthModule,
    UsersModule,
    SellersModule,
    ProductsModule,
    DeliveryModule,
    OrdersModule,
    PaymentsModule,
    PaymentProvidersModule,
    DisputesModule,
    WebhooksModule,
    PayoutsModule,
    SettlementModule,
  ],
  providers: [
    // Validation lives here (not only in main.ts) so the e2e tests exercise the same rules as production.
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true }) },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
