import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  InitiatePaymentRequest,
  InitiatePaymentResult,
  PaymentProviderService,
  PayoutInstruction,
  RefundInstruction,
  SettlementInstructionResult,
} from './payment-provider.interface';

/**
 * Stand-in for PalmPay while their marketplace/platform API documentation
 * is still pending (per BuyBridge: Fund Custody & Settlement Model §5 —
 * PalmPay's licensing is fine in principle, but public API docs are thin,
 * and a direct business conversation is needed before building against
 * the real thing).
 *
 * This mock mimics the *shape* we expect from a Model B MMO/MFB partner:
 * an async confirm-by-webhook payment flow, and payout/refund instructions
 * that are "sent" immediately but only really take effect once the
 * (also-mocked) webhook confirms them. Swap this provider for the real
 * PalmPayProvider implementation of PaymentProviderService the moment the
 * real API spec is in hand — nothing else in the codebase should need to
 * change.
 */
@Injectable()
export class MockPalmPayProvider implements PaymentProviderService {
  readonly providerName = 'PALMPAY_MOCK';
  private readonly logger = new Logger(MockPalmPayProvider.name);

  async initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    const providerTransactionRef = `mock_palmpay_txn_${randomUUID()}`;
    this.logger.debug(
      `[mock] initiatePayment order=${request.orderReference} amount=${request.amountMinor} ref=${providerTransactionRef}`,
    );
    return {
      providerTransactionRef,
      paymentInstruction: {
        type: 'MOCK_CHECKOUT',
        checkoutUrl: `https://mock-palmpay.local/checkout/${providerTransactionRef}`,
        note: 'Mock provider — call POST /webhooks/palmpay with eventType=payment.confirmed to simulate the partner confirming payment.',
      },
    };
  }

  async sendPayoutInstruction(instruction: PayoutInstruction): Promise<SettlementInstructionResult> {
    const providerInstructionRef = `mock_palmpay_payout_${randomUUID()}`;
    this.logger.debug(
      `[mock] sendPayoutInstruction txn=${instruction.paymentProviderTransactionRef} amount=${instruction.amountMinor} key=${instruction.idempotencyKey}`,
    );
    return { providerInstructionRef, status: 'INSTRUCTION_SENT' };
  }

  async sendRefundInstruction(instruction: RefundInstruction): Promise<SettlementInstructionResult> {
    const providerInstructionRef = `mock_palmpay_refund_${randomUUID()}`;
    this.logger.debug(
      `[mock] sendRefundInstruction txn=${instruction.paymentProviderTransactionRef} amount=${instruction.amountMinor} key=${instruction.idempotencyKey}`,
    );
    return { providerInstructionRef, status: 'INSTRUCTION_SENT' };
  }

  verifyWebhookSignature(_rawBody: Buffer | string, _headers: Record<string, string>): boolean {
    // Mock accepts everything. The real PalmPayProvider MUST verify an
    // HMAC/signature header here before any webhook payload is trusted.
    return true;
  }
}
