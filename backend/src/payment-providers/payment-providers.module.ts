import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { MockPalmPayProvider } from './mock-palmpay.provider';

/**
 * Binds PAYMENT_PROVIDER to MockPalmPayProvider today. To go live with the
 * real PalmPay integration once their API docs arrive: implement
 * PaymentProviderService in a new `palmpay.provider.ts`, and change only
 * the `useClass` below (or branch on config so the mock remains available
 * for tests/dev).
 */
@Module({
  providers: [
    MockPalmPayProvider,
    {
      provide: PAYMENT_PROVIDER,
      useClass: MockPalmPayProvider,
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentProvidersModule {}
