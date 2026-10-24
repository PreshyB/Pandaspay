import {
  isTerminalDisposition,
  isValidPaymentTransition,
  PaymentProtectionStatus,
} from './payment-protection-status.enum';

describe('PaymentProtectionStatus transitions (state-machine spec §3.2)', () => {
  it('allows the happy path: AWAITING_PAYMENT -> PROTECTED -> RELEASABLE -> RELEASED', () => {
    expect(isValidPaymentTransition(PaymentProtectionStatus.AWAITING_PAYMENT, PaymentProtectionStatus.PROTECTED)).toBe(true);
    expect(isValidPaymentTransition(PaymentProtectionStatus.PROTECTED, PaymentProtectionStatus.RELEASABLE)).toBe(true);
    expect(isValidPaymentTransition(PaymentProtectionStatus.RELEASABLE, PaymentProtectionStatus.RELEASED)).toBe(true);
  });

  it('allows a declined payment to be retried with a new idempotency key', () => {
    expect(isValidPaymentTransition(PaymentProtectionStatus.AWAITING_PAYMENT, PaymentProtectionStatus.PAYMENT_DECLINED)).toBe(true);
    expect(isValidPaymentTransition(PaymentProtectionStatus.PAYMENT_DECLINED, PaymentProtectionStatus.AWAITING_PAYMENT)).toBe(true);
  });

  it('allows a dispute to open from PROTECTED or from RELEASABLE (the race-sensitive late-dispute path)', () => {
    expect(isValidPaymentTransition(PaymentProtectionStatus.PROTECTED, PaymentProtectionStatus.DISPUTED)).toBe(true);
    expect(isValidPaymentTransition(PaymentProtectionStatus.RELEASABLE, PaymentProtectionStatus.DISPUTED)).toBe(true);
  });

  it('allows all three dispute resolutions', () => {
    expect(isValidPaymentTransition(PaymentProtectionStatus.DISPUTED, PaymentProtectionStatus.RELEASABLE)).toBe(true);
    expect(isValidPaymentTransition(PaymentProtectionStatus.DISPUTED, PaymentProtectionStatus.REFUND_APPROVED)).toBe(true);
    expect(isValidPaymentTransition(PaymentProtectionStatus.DISPUTED, PaymentProtectionStatus.PARTIALLY_RESOLVED)).toBe(true);
  });

  it('never allows a transition out of a terminal disposition', () => {
    for (const terminal of [
      PaymentProtectionStatus.RELEASED,
      PaymentProtectionStatus.REFUNDED,
      PaymentProtectionStatus.PARTIALLY_RESOLVED,
    ]) {
      expect(isTerminalDisposition(terminal)).toBe(true);
      for (const candidate of Object.values(PaymentProtectionStatus)) {
        expect(isValidPaymentTransition(terminal, candidate)).toBe(false);
      }
    }
  });

  it('rejects jumping straight from AWAITING_PAYMENT to RELEASED', () => {
    expect(isValidPaymentTransition(PaymentProtectionStatus.AWAITING_PAYMENT, PaymentProtectionStatus.RELEASED)).toBe(false);
  });

  it('rejects re-disputing a RELEASABLE transaction’s sibling states incorrectly (DISPUTED cannot re-enter itself)', () => {
    expect(isValidPaymentTransition(PaymentProtectionStatus.DISPUTED, PaymentProtectionStatus.DISPUTED)).toBe(false);
  });
});
