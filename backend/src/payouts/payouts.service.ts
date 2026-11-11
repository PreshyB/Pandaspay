import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { PaymentProtectionStatus as S } from '../common/enums/payment-protection-status.enum';
import { Payment } from '../payments/entities/payment.entity';
import { Settlement, SettlementKind } from '../payments/entities/settlement.entity';
import { PaymentsService } from '../payments/payments.service';
import { PayoutAccount, PayoutRequest, PayoutRequestStatus } from './payout.entities';

const mask = (n: string) => `••••${n.slice(-4)}`;

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(PayoutAccount) private readonly accounts: Repository<PayoutAccount>,
    @InjectRepository(PayoutRequest) private readonly requests: Repository<PayoutRequest>,
    private readonly dataSource: DataSource,
    private readonly paymentsService: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  async getAccount(userId: string) {
    const a = await this.accounts.findOneBy({ userId });
    return a ? { bankName: a.bankName, accountName: a.accountName, accountNumberMasked: mask(a.accountNumber) } : null;
  }

  async saveAccount(userId: string, input: { bankName: string; accountName: string; accountNumber: string }) {
    const bankName = input.bankName?.trim();
    const accountName = input.accountName?.trim();
    const accountNumber = input.accountNumber?.replace(/\s/g, '');
    if (!bankName || !accountName) throw new BadRequestException('Enter the bank and the name on the account.');
    if (!/^\d{10}$/.test(accountNumber ?? '')) throw new BadRequestException('A Nigerian account number has 10 digits.');
    const existing = await this.accounts.findOneBy({ userId });
    await this.accounts.save(this.accounts.create({ ...existing, userId, bankName, accountName, accountNumber }));
    return this.getAccount(userId);
  }

  private async openRequestPaymentIds(sellerId: string): Promise<Set<string>> {
    const open = await this.requests.find({ where: { sellerId, status: PayoutRequestStatus.REQUESTED } });
    return new Set(open.flatMap((r) => r.paymentIds));
  }

  /** Sales and settlement view, worked out from payment records. There is no wallet or balance table (Model B). */
  async summary(sellerId: string) {
    const payments = await this.dataSource.getRepository(Payment).find({
      where: { order: { sellerId } },
      order: { createdAt: 'DESC' },
    });
    const requested = await this.openRequestPaymentIds(sellerId);
    const splitIds = payments.filter((p) => p.protectionStatus === S.PARTIALLY_RESOLVED).map((p) => p.id);
    const splitPayouts = new Map<string, bigint>();
    if (splitIds.length) {
      const rows = await this.dataSource.getRepository(Settlement).find({ where: splitIds.map((paymentId) => ({ paymentId, kind: SettlementKind.PAYOUT })) });
      for (const r of rows) splitPayouts.set(r.paymentId, (splitPayouts.get(r.paymentId) ?? BigInt(0)) + BigInt(r.amountMinor));
    }

    const t = { pending: BigInt(0), onHold: BigInt(0), eligible: BigInt(0), requested: BigInt(0), paidOut: BigInt(0), refunded: BigInt(0) };
    const items: Array<{ paymentId: string; orderId: string; amountMinor: string; bucket: string; at: Date }> = [];
    for (const p of payments) {
      const amt = BigInt(p.amountMinor);
      let bucket: string | null = null;
      switch (p.protectionStatus) {
        case S.PROTECTED:
          t.pending += amt;
          bucket = 'PENDING_SETTLEMENT';
          break;
        case S.DISPUTED:
          t.onHold += amt;
          bucket = 'ON_HOLD';
          break;
        case S.RELEASABLE:
          if (requested.has(p.id)) {
            t.requested += amt;
            bucket = 'PAYOUT_REQUESTED';
          } else {
            t.eligible += amt;
            bucket = 'ELIGIBLE';
          }
          break;
        case S.RELEASED:
          t.paidOut += amt;
          bucket = 'PAID_OUT';
          break;
        case S.PARTIALLY_RESOLVED:
          t.paidOut += splitPayouts.get(p.id) ?? BigInt(0);
          bucket = 'PAID_OUT';
          break;
        case S.REFUND_APPROVED:
        case S.REFUNDED:
          t.refunded += amt;
          bucket = 'REFUNDED';
          break;
        default:
          break; // awaiting or declined payments are not sales yet
      }
      if (bucket) items.push({ paymentId: p.id, orderId: p.orderId, amountMinor: p.amountMinor, bucket, at: p.updatedAt });
    }
    return {
      currency: payments[0]?.currency ?? 'NGN',
      pendingSettlementMinor: t.pending.toString(),
      onHoldMinor: t.onHold.toString(),
      eligibleMinor: t.eligible.toString(),
      payoutRequestedMinor: t.requested.toString(),
      paidOutMinor: t.paidOut.toString(),
      refundedMinor: t.refunded.toString(),
      items,
    };
  }

  requestsFor(sellerId: string) {
    return this.requests.find({ where: { sellerId }, order: { createdAt: 'DESC' } });
  }

  listByStatus(status: PayoutRequestStatus) {
    return this.requests.find({ where: { status }, order: { createdAt: 'ASC' } });
  }

  /** Bundles everything currently eligible into one request for an admin to approve. */
  async request(sellerId: string): Promise<PayoutRequest> {
    const account = await this.accounts.findOneBy({ userId: sellerId });
    if (!account) throw new BadRequestException('Add the bank account you want to be paid into first.');

    const taken = await this.openRequestPaymentIds(sellerId);
    const payments = await this.dataSource
      .getRepository(Payment)
      .find({ where: { protectionStatus: S.RELEASABLE, order: { sellerId } } });
    const eligible = payments.filter((p) => !taken.has(p.id));
    if (eligible.length === 0) throw new BadRequestException('Nothing is eligible for payout yet.');

    const amount = eligible.reduce((n, p) => n + BigInt(p.amountMinor), BigInt(0));
    return this.requests.save(
      this.requests.create({
        sellerId,
        paymentIds: eligible.map((p) => p.id),
        amountMinor: amount.toString(),
        currency: eligible[0].currency,
        destination: { bankName: account.bankName, accountName: account.accountName, accountNumber: account.accountNumber },
      }),
    );
  }

  private async openRequest(id: string) {
    const req = await this.requests.findOneBy({ id });
    if (!req) throw new NotFoundException('Payout request not found.');
    if (req.status !== PayoutRequestStatus.REQUESTED) throw new BadRequestException('This request has already been decided.');
    return req;
  }

  /**
   * Approval is the control point: only now do payout instructions go to the partner. Each payment is
   * released through the disposition lock, so one that was disputed in the meantime is skipped, not paid.
   */
  async approve(id: string, adminId: string) {
    const req = await this.openRequest(id);
    // Claim the request first so two admins cannot both approve it.
    const claimed = await this.requests.update({ id, status: PayoutRequestStatus.REQUESTED }, { status: PayoutRequestStatus.APPROVED });
    if (!claimed.affected) throw new BadRequestException('This request has already been decided.');

    const skipped: string[] = [];
    for (const paymentId of req.paymentIds) {
      try {
        await this.paymentsService.release(paymentId, { ...req.destination, sellerId: req.sellerId, payoutRequestId: id });
      } catch {
        skipped.push(paymentId);
      }
    }
    await this.requests.update(id, { skippedPaymentIds: skipped, reviewedById: adminId, reviewedAt: new Date() });
    await this.audit.record({
      actorId: adminId,
      action: 'PAYOUT_APPROVED',
      targetType: 'payout_request',
      targetId: id,
      details: { amountMinor: req.amountMinor, paymentCount: req.paymentIds.length, skipped },
    });
    return this.requests.findOneByOrFail({ id });
  }

  async reject(id: string, adminId: string, reason: string) {
    await this.openRequest(id);
    await this.requests.update(id, { status: PayoutRequestStatus.REJECTED, reviewNote: reason, reviewedById: adminId, reviewedAt: new Date() });
    await this.audit.record({ actorId: adminId, action: 'PAYOUT_REJECTED', targetType: 'payout_request', targetId: id, details: { reason } });
    return this.requests.findOneByOrFail({ id });
  }
}
