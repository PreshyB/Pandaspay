/**
 * PaymentProviderService — the single seam between BuyBridge and whichever
 * licensed partner actually holds the money under Model B (see BuyBridge:
 * Fund Custody & Settlement Model). Every provider (PalmPay today, possibly
 * Moniepoint MFB / a specialist MFB later) implements this interface.
 *
 * Nothing outside this module may construct a provider-specific client —
 * PaymentsService only ever depends on this interface, injected via the
 * PAYMENT_PROVIDER token. That is what makes swapping the mock for the real
 * PalmPay integration (once their API docs land) a one-file change, not a
 * rewrite of the order/payment logic.
 */

export interface InitiatePaymentRequest {
  /** BuyBridge's own idempotency key for this payment attempt. */
  idempotencyKey: string;
  amountMinor: string;
  currency: string;
  buyerReference: string;
  orderReference: string;
}

export interface InitiatePaymentResult {
  /** The provider's own reference for this payment attempt. */
  providerTransactionRef: string;
  /** Where/how the buyer completes payment (checkout URL, USSD code, etc.) — provider-specific shape. */
  paymentInstruction: Record<string, unknown>;
}

export interface PayoutInstruction {
  idempotencyKey: string;
  paymentProviderTransactionRef: string;
  amountMinor: string;
  currency: string;
  sellerPayoutDestination: Record<string, unknown>;
}

export interface RefundInstruction {
  idempotencyKey: string;
  paymentProviderTransactionRef: string;
  amountMinor: string;
  currency: string;
}

export interface SettlementInstructionResult {
  providerInstructionRef: string;
  /** Model B: BuyBridge records the instruction was sent; execution is confirmed later via webhook. */
  status: 'INSTRUCTION_SENT';
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProviderService {
  readonly providerName: string;

  initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResult>;

  /** Sends a payout instruction to the licensed partner. Never moves money directly. */
  sendPayoutInstruction(instruction: PayoutInstruction): Promise<SettlementInstructionResult>;

  /** Sends a refund instruction to the licensed partner. Never moves money directly. */
  sendRefundInstruction(instruction: RefundInstruction): Promise<SettlementInstructionResult>;

  /** Verifies an inbound webhook's signature/authenticity before it is trusted. */
  verifyWebhookSignature(rawBody: Buffer | string, headers: Record<string, string>): boolean;
}
