/**
 * Payment protection status — the financial track.
 * Owned by the buyer's payment, the licensed partner's custody of funds
 * (Model B — see Pandas Pay: Fund Custody & Settlement Model), and any dispute.
 *
 * Source of truth: Pandas Pay — Order Status & Payment Protection
 * State-Machine Specification v1.0 (8 Oct 2026), §3.
 *
 * Pandas Pay never marks a transaction RELEASED or REFUNDED on its own
 * say-so — only on the licensed partner's confirmation (webhook).
 */
export enum PaymentProtectionStatus {
  /** Buyer has not yet completed payment, or the provider hasn't confirmed it. Initial state. */
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  /** Provider declined the attempt. Not terminal — order/reservation survive. */
  PAYMENT_DECLINED = 'PAYMENT_DECLINED',
  /** Payment confirmed and sits in the licensed partner's designated/collection account. */
  PROTECTED = 'PROTECTED',
  /** A dispute is open. Freezes the payment track — no release, refund or settlement may fire. */
  DISPUTED = 'DISPUTED',
  /** Protection window elapsed (or buyer confirmed receipt), no open dispute. Queued for payout. */
  RELEASABLE = 'RELEASABLE',
  /** Terminal. Payout instruction sent to and confirmed by the licensed partner. */
  RELEASED = 'RELEASED',
  /** Full refund decided; refund instruction queued to the licensed partner. */
  REFUND_APPROVED = 'REFUND_APPROVED',
  /** Terminal. Licensed partner confirmed the refund instruction executed. */
  REFUNDED = 'REFUNDED',
  /** Terminal. Dispute resolved as a split — part released, part refunded. */
  PARTIALLY_RESOLVED = 'PARTIALLY_RESOLVED',
}

/** The three dispositions a protection transaction may terminally settle into. Never two. */
export const TERMINAL_DISPOSITIONS: PaymentProtectionStatus[] = [
  PaymentProtectionStatus.RELEASED,
  PaymentProtectionStatus.REFUNDED,
  PaymentProtectionStatus.PARTIALLY_RESOLVED,
];

export function isTerminalDisposition(status: PaymentProtectionStatus): boolean {
  return TERMINAL_DISPOSITIONS.includes(status);
}

/**
 * Valid payment-protection-status transitions, per spec §3.2.
 * Keyed by "from" state; value is the set of states that state may move to.
 */
export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentProtectionStatus, PaymentProtectionStatus[]> = {
  [PaymentProtectionStatus.AWAITING_PAYMENT]: [
    PaymentProtectionStatus.PROTECTED,
    PaymentProtectionStatus.PAYMENT_DECLINED,
  ],
  [PaymentProtectionStatus.PAYMENT_DECLINED]: [PaymentProtectionStatus.AWAITING_PAYMENT],
  [PaymentProtectionStatus.PROTECTED]: [
    PaymentProtectionStatus.DISPUTED,
    PaymentProtectionStatus.RELEASABLE,
    PaymentProtectionStatus.REFUND_APPROVED, // pre-acceptance cancellation path
  ],
  [PaymentProtectionStatus.DISPUTED]: [
    PaymentProtectionStatus.RELEASABLE,
    PaymentProtectionStatus.REFUND_APPROVED,
    PaymentProtectionStatus.PARTIALLY_RESOLVED,
  ],
  [PaymentProtectionStatus.RELEASABLE]: [
    PaymentProtectionStatus.DISPUTED, // late-opened dispute, race-sensitive — see disposition lock
    PaymentProtectionStatus.RELEASED,
  ],
  [PaymentProtectionStatus.RELEASED]: [],
  [PaymentProtectionStatus.REFUND_APPROVED]: [PaymentProtectionStatus.REFUNDED],
  [PaymentProtectionStatus.REFUNDED]: [],
  [PaymentProtectionStatus.PARTIALLY_RESOLVED]: [],
};

export function isValidPaymentTransition(
  from: PaymentProtectionStatus,
  to: PaymentProtectionStatus,
): boolean {
  return PAYMENT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
