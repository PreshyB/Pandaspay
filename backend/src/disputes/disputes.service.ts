import { BadRequestException, ConflictException, Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { PaymentsService } from '../payments/payments.service';
import { DispositionLockService } from '../payments/disposition-lock.service';
import { FinancialTransactionType } from '../payments/financial-transaction.entity';
import { LedgerService } from '../payments/ledger.service';
import { PaymentProtectionStatus } from '../common/enums/payment-protection-status.enum';
import { Payment } from '../payments/entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { PaymentEvent } from '../payments/entities/payment-event.entity';
import { Settlement, SettlementKind } from '../payments/entities/settlement.entity';
import {
  PAYMENT_PROVIDER,
  PaymentProviderService,
} from '../payment-providers/payment-provider.interface';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface ResolveSplitInput {
  releaseMinor: string;
  refundMinor: string;
  sellerPayoutDestination: Record<string, unknown>;
}

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute) private readonly disputes: Repository<Dispute>,
    private readonly paymentsService: PaymentsService,
    private readonly dispositionLock: DispositionLockService,
    private readonly ledger: LedgerService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderService,
    private readonly dataSource: DataSource,
  ) {}

  /** Admin queue: every dispute with the order and payment it concerns, newest first. */
  async listWithContext(status?: DisputeStatus) {
    const disputes = await this.disputes.find({ where: status ? { status } : {}, order: { createdAt: 'DESC' } });
    const out = [];
    for (const d of disputes) {
      const payment = await this.dataSource.getRepository(Payment).findOneBy({ id: d.paymentId });
      const order = payment ? await this.dataSource.getRepository(Order).findOne({ where: { id: payment.orderId }, relations: ['items'] }) : null;
      out.push({ ...d, payment, order });
    }
    return out;
  }

  async getWithContext(disputeId: string) {
    const list = await this.listWithContext();
    return list.find((d) => d.id === disputeId) ?? null;
  }

  /** Only the buyer on the order can open a dispute on its payment. */
  async assertBuyerOfPayment(paymentId: string, userId: string) {
    const payment = await this.dataSource.getRepository(Payment).findOneByOrFail({ id: paymentId });
    const order = await this.dataSource.getRepository(Order).findOneByOrFail({ id: payment.orderId });
    if (order.buyerId !== userId) throw new ForbiddenException('Only the buyer can open a dispute on this payment.');
  }

  async open(paymentId: string, openedById: string, reason: string, details?: string): Promise<Dispute> {
    // Moves the payment track to DISPUTED first (spec §3.2); the dispute
    // case record is BuyBridge's operational bookkeeping on top of that.
    await this.paymentsService.openDispute(paymentId, 'BUYER', openedById, reason);

    const dispute = this.disputes.create({ paymentId, openedById, reason, details, status: DisputeStatus.OPEN });
    return this.disputes.save(dispute);
  }

  /**
   * Marks the dispute decided inside the same transaction as the money change. The conditional write means
   * two admins deciding at once cannot both win: the second finds it already closed and the whole step rolls back.
   */
  private async closeDispute(manager: EntityManager, disputeId: string, fields: Partial<Dispute>) {
    const r = await manager
      .createQueryBuilder()
      .update(Dispute)
      .set({ ...fields, resolvedAt: new Date() })
      .where('id = :id', { id: disputeId })
      .andWhere('status IN (:...open)', { open: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] })
      .execute();
    if (!r.affected) throw new ConflictException(`Dispute ${disputeId} was already decided.`);
  }

  /** DISPUTED -> RELEASABLE. Re-enters the normal release path (spec §3.2). Guarded so it cannot race a refund decision. */
  async resolveInSellersFavor(disputeId: string, resolvedById: string, notes?: string): Promise<Dispute> {
    const dispute = await this.disputes.findOneByOrFail({ id: disputeId });
    this.assertOpen(dispute);

    await this.dataSource.transaction(async (manager) => {
      await this.closeDispute(manager, disputeId, { status: DisputeStatus.RESOLVED_SELLER, resolvedById, resolutionNotes: notes });
      await this.dispositionLock.acquire(manager, dispute.paymentId, PaymentProtectionStatus.DISPUTED, PaymentProtectionStatus.RELEASABLE);
      await manager.getRepository(Payment).update({ id: dispute.paymentId }, { releasableAt: new Date() });
      await manager.getRepository(PaymentEvent).save(
        manager.getRepository(PaymentEvent).create({
          paymentId: dispute.paymentId,
          fromStatus: PaymentProtectionStatus.DISPUTED,
          toStatus: PaymentProtectionStatus.RELEASABLE,
          actorType: 'ADMIN',
          actorRef: resolvedById,
          reason: notes ?? 'Dispute resolved in seller’s favor',
        }),
      );
    });
    return this.disputes.findOneByOrFail({ id: disputeId });
  }

  /** DISPUTED -> REFUND_APPROVED. Acquires the disposition lock (spec §5), then sends the refund instruction. */
  async resolveInBuyersFavor(disputeId: string, resolvedById: string, notes?: string): Promise<Dispute> {
    const dispute = await this.disputes.findOneByOrFail({ id: disputeId });
    this.assertOpen(dispute);

    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.getRepository(Payment).findOneByOrFail({ id: dispute.paymentId });
      await this.closeDispute(manager, disputeId, { status: DisputeStatus.RESOLVED_BUYER, resolvedById, resolutionNotes: notes });

      await this.dispositionLock.acquire(
        manager,
        dispute.paymentId,
        PaymentProtectionStatus.DISPUTED,
        PaymentProtectionStatus.REFUND_APPROVED,
      );

      const idempotencyKey = `refund:${dispute.paymentId}:REFUND_APPROVED:${disputeId}`;
      const instructionResult = await this.provider.sendRefundInstruction({
        idempotencyKey,
        paymentProviderTransactionRef: payment.providerTransactionRef ?? payment.id,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
      });

      await manager.getRepository(Settlement).save(
        manager.getRepository(Settlement).create({
          paymentId: dispute.paymentId,
          kind: SettlementKind.REFUND,
          amountMinor: payment.amountMinor,
          idempotencyKey,
          providerInstructionRef: instructionResult.providerInstructionRef,
        }),
      );
      await this.ledger.record(
        { paymentId: dispute.paymentId, type: FinancialTransactionType.REFUND_INSTRUCTED, amountMinor: payment.amountMinor, currency: payment.currency, reference: idempotencyKey },
        manager,
      );

      await manager.getRepository(PaymentEvent).save(
        manager.getRepository(PaymentEvent).create({
          paymentId: dispute.paymentId,
          fromStatus: PaymentProtectionStatus.DISPUTED,
          toStatus: PaymentProtectionStatus.REFUND_APPROVED,
          actorType: 'ADMIN',
          actorRef: resolvedById,
          reason: notes ?? 'Dispute resolved in buyer’s favor — full refund',
        }),
      );
    });
    return this.disputes.findOneByOrFail({ id: disputeId });
  }

  /**
   * DISPUTED -> PARTIALLY_RESOLVED. Acquires the lock exactly once; the two
   * linked instructions (partial payout + partial refund) are written and
   * sent together under that single disposition (spec §5).
   */
  async resolveAsSplit(disputeId: string, resolvedById: string, input: ResolveSplitInput, notes?: string): Promise<Dispute> {
    const dispute = await this.disputes.findOneByOrFail({ id: disputeId });
    this.assertOpen(dispute);

    // Both parts must be whole, positive amounts. (A one-sided outcome is a seller or buyer decision, not a split.)
    const isAmount = (v: unknown) => typeof v === 'string' && /^[1-9]\d*$/.test(v);
    if (!isAmount(input.releaseMinor) || !isAmount(input.refundMinor)) {
      throw new BadRequestException('A split needs a positive amount for both the seller and the buyer.');
    }

    const dispositionGroupId = randomUUID();

    await this.dataSource.transaction(async (manager) => {
      const payment = await manager.getRepository(Payment).findOneByOrFail({ id: dispute.paymentId });

      const sum = BigInt(input.releaseMinor) + BigInt(input.refundMinor);
      if (sum.toString() !== BigInt(payment.amountMinor).toString()) {
        throw new BadRequestException('Split release + refund amounts must sum to the protected amount');
      }

      await this.closeDispute(manager, disputeId, {
        status: DisputeStatus.RESOLVED_SPLIT,
        splitReleaseMinor: input.releaseMinor,
        splitRefundMinor: input.refundMinor,
        resolvedById,
        resolutionNotes: notes,
      });

      await this.dispositionLock.acquire(
        manager,
        dispute.paymentId,
        PaymentProtectionStatus.DISPUTED,
        PaymentProtectionStatus.PARTIALLY_RESOLVED,
      );

      const payoutKey = `payout:${dispute.paymentId}:PARTIALLY_RESOLVED:${disputeId}`;
      const refundKey = `refund:${dispute.paymentId}:PARTIALLY_RESOLVED:${disputeId}`;

      const payoutResult = await this.provider.sendPayoutInstruction({
        idempotencyKey: payoutKey,
        paymentProviderTransactionRef: payment.providerTransactionRef ?? payment.id,
        amountMinor: input.releaseMinor,
        currency: payment.currency,
        sellerPayoutDestination: input.sellerPayoutDestination,
      });
      const refundResult = await this.provider.sendRefundInstruction({
        idempotencyKey: refundKey,
        paymentProviderTransactionRef: payment.providerTransactionRef ?? payment.id,
        amountMinor: input.refundMinor,
        currency: payment.currency,
      });

      const settlementRepo = manager.getRepository(Settlement);
      await settlementRepo.save([
        settlementRepo.create({
          paymentId: dispute.paymentId,
          kind: SettlementKind.PAYOUT,
          amountMinor: input.releaseMinor,
          idempotencyKey: payoutKey,
          providerInstructionRef: payoutResult.providerInstructionRef,
          dispositionGroupId,
        }),
        settlementRepo.create({
          paymentId: dispute.paymentId,
          kind: SettlementKind.REFUND,
          amountMinor: input.refundMinor,
          idempotencyKey: refundKey,
          providerInstructionRef: refundResult.providerInstructionRef,
          dispositionGroupId,
        }),
      ]);
      await this.ledger.record({ paymentId: dispute.paymentId, type: FinancialTransactionType.PAYOUT_INSTRUCTED, amountMinor: input.releaseMinor, currency: payment.currency, reference: payoutKey }, manager);
      await this.ledger.record({ paymentId: dispute.paymentId, type: FinancialTransactionType.REFUND_INSTRUCTED, amountMinor: input.refundMinor, currency: payment.currency, reference: refundKey }, manager);

      await manager.getRepository(PaymentEvent).save(
        manager.getRepository(PaymentEvent).create({
          paymentId: dispute.paymentId,
          fromStatus: PaymentProtectionStatus.DISPUTED,
          toStatus: PaymentProtectionStatus.PARTIALLY_RESOLVED,
          actorType: 'ADMIN',
          actorRef: resolvedById,
          reason: notes ?? `Dispute resolved as a split (release=${input.releaseMinor}, refund=${input.refundMinor})`,
        }),
      );
    });
    return this.disputes.findOneByOrFail({ id: disputeId });
  }

  private assertOpen(dispute: Dispute) {
    if (dispute.status !== DisputeStatus.OPEN && dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Dispute ${dispute.id} is already resolved (${dispute.status})`);
    }
  }
}
