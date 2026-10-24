import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Payment } from './entities/payment.entity';
import { PaymentEvent, PaymentEventActorType } from './entities/payment-event.entity';
import { Settlement, SettlementKind } from './entities/settlement.entity';
import {
  isValidPaymentTransition,
  PaymentProtectionStatus,
} from '../common/enums/payment-protection-status.enum';
import { DispositionLockService } from './disposition-lock.service';
import {
  PAYMENT_PROVIDER,
  PaymentProviderService,
} from '../payment-providers/payment-provider.interface';

/** The protection window: how long after DELIVERED before funds become RELEASABLE. Spec §4. */
export const PROTECTION_WINDOW_HOURS = 72;

export interface RecordPaymentAttemptInput {
  orderId: string;
  amountMinor: string;
  currency: string;
  buyerReference: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(PaymentEvent) private readonly paymentEvents: Repository<PaymentEvent>,
    @InjectRepository(Settlement) private readonly settlements: Repository<Settlement>,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderService,
    private readonly dispositionLock: DispositionLockService,
    private readonly dataSource: DataSource,
  ) {}

  /** Creates the payment row for a freshly created order and kicks off the provider payment attempt. */
  async initiateForOrder(input: RecordPaymentAttemptInput) {
    const attemptIdempotencyKey = randomUUID();

    const payment = this.payments.create({
      orderId: input.orderId,
      protectionStatus: PaymentProtectionStatus.AWAITING_PAYMENT,
      amountMinor: input.amountMinor,
      currency: input.currency,
      providerName: this.provider.providerName,
      attemptIdempotencyKey,
    });
    await this.payments.save(payment);
    await this.recordEvent(payment.id, undefined, PaymentProtectionStatus.AWAITING_PAYMENT, 'SYSTEM_SCHEDULER', undefined, 'Order created; payment attempt initiated');

    const providerResult = await this.provider.initiatePayment({
      idempotencyKey: attemptIdempotencyKey,
      amountMinor: input.amountMinor,
      currency: input.currency,
      buyerReference: input.buyerReference,
      orderReference: input.orderId,
    });

    payment.providerTransactionRef = providerResult.providerTransactionRef;
    await this.payments.save(payment);

    return { payment, paymentInstruction: providerResult.paymentInstruction };
  }

  /**
   * AWAITING_PAYMENT -> PROTECTED, fired by the licensed partner's webhook.
   * Idempotent against providerTransactionRef — a redelivered webhook must
   * not double-protect (spec §3.2).
   */
  async confirmProtected(providerTransactionRef: string, webhookEventId: string): Promise<Payment> {
    const payment = await this.payments.findOneByOrFail({ providerTransactionRef });

    if (payment.protectionStatus !== PaymentProtectionStatus.AWAITING_PAYMENT) {
      this.logger.debug(
        `confirmProtected: payment=${payment.id} already at ${payment.protectionStatus}; treating redelivered webhook as a no-op`,
      );
      return payment;
    }

    this.assertTransition(payment.protectionStatus, PaymentProtectionStatus.PROTECTED);
    const from = payment.protectionStatus;
    payment.protectionStatus = PaymentProtectionStatus.PROTECTED;
    payment.protectedAt = new Date();
    await this.payments.save(payment);
    await this.recordEvent(payment.id, from, payment.protectionStatus, 'PROVIDER_WEBHOOK', webhookEventId, 'Licensed partner confirmed payment received into designated account');
    return payment;
  }

  async declinePayment(providerTransactionRef: string, webhookEventId: string): Promise<Payment> {
    const payment = await this.payments.findOneByOrFail({ providerTransactionRef });
    if (payment.protectionStatus !== PaymentProtectionStatus.AWAITING_PAYMENT) return payment;

    this.assertTransition(payment.protectionStatus, PaymentProtectionStatus.PAYMENT_DECLINED);
    const from = payment.protectionStatus;
    payment.protectionStatus = PaymentProtectionStatus.PAYMENT_DECLINED;
    await this.payments.save(payment);
    await this.recordEvent(payment.id, from, payment.protectionStatus, 'PROVIDER_WEBHOOK', webhookEventId, 'Provider declined the payment attempt');
    return payment;
  }

  /** PAYMENT_DECLINED -> AWAITING_PAYMENT with a new idempotency key (spec §3.2). */
  async retryPayment(paymentId: string): Promise<{ payment: Payment; paymentInstruction: Record<string, unknown> }> {
    const payment = await this.payments.findOneByOrFail({ id: paymentId });
    this.assertTransition(payment.protectionStatus, PaymentProtectionStatus.AWAITING_PAYMENT);

    const from = payment.protectionStatus;
    const newKey = randomUUID();
    payment.attemptIdempotencyKey = newKey;
    payment.protectionStatus = PaymentProtectionStatus.AWAITING_PAYMENT;
    await this.payments.save(payment);
    await this.recordEvent(payment.id, from, payment.protectionStatus, 'BUYER', undefined, 'Buyer retried a declined payment with a new idempotency key');

    const providerResult = await this.provider.initiatePayment({
      idempotencyKey: newKey,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      buyerReference: payment.orderId,
      orderReference: payment.orderId,
    });
    payment.providerTransactionRef = providerResult.providerTransactionRef;
    await this.payments.save(payment);

    return { payment, paymentInstruction: providerResult.paymentInstruction };
  }

  /**
   * PROTECTED/RELEASABLE -> DISPUTED. Allowed up until the moment a release
   * instruction has actually been recorded (spec §3.2, §5) — this write is
   * itself a conditional UPDATE guarding the RELEASABLE -> DISPUTED race
   * against a concurrent settlement-job release.
   */
  async openDispute(paymentId: string, actorType: PaymentEventActorType, actorRef: string, reason: string): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Payment);
      const payment = await repo.findOneByOrFail({ id: paymentId });

      if (
        payment.protectionStatus !== PaymentProtectionStatus.PROTECTED &&
        payment.protectionStatus !== PaymentProtectionStatus.RELEASABLE
      ) {
        throw new BadRequestException(
          `Cannot open a dispute on payment ${paymentId}: it is at ${payment.protectionStatus}, not PROTECTED or RELEASABLE`,
        );
      }

      const from = payment.protectionStatus;
      const result = await manager
        .createQueryBuilder()
        .update(Payment)
        .set({ protectionStatus: PaymentProtectionStatus.DISPUTED })
        .where('id = :paymentId', { paymentId })
        .andWhere('"protectionStatus" = :from', { from })
        .execute();

      if ((result.affected ?? 0) === 0) {
        throw new BadRequestException(
          `Payment ${paymentId} moved out of ${from} (likely already released) before the dispute could open`,
        );
      }

      await manager.getRepository(PaymentEvent).save(
        manager.getRepository(PaymentEvent).create({
          paymentId,
          fromStatus: from,
          toStatus: PaymentProtectionStatus.DISPUTED,
          actorType,
          actorRef,
          reason,
        }),
      );

      return repo.findOneByOrFail({ id: paymentId });
    });
  }

  /**
   * PROTECTED -> RELEASABLE, driven by the order's DELIVERED event plus
   * the elapsed protection window (spec §4). Called by OrdersService when
   * it marks an order DELIVERED, and may also be called by a scheduled
   * sweep for orders whose window has already elapsed.
   */
  async markReleasable(paymentId: string): Promise<Payment> {
    const payment = await this.payments.findOneByOrFail({ id: paymentId });
    if (payment.protectionStatus !== PaymentProtectionStatus.PROTECTED) return payment;

    this.assertTransition(payment.protectionStatus, PaymentProtectionStatus.RELEASABLE);
    const from = payment.protectionStatus;
    payment.protectionStatus = PaymentProtectionStatus.RELEASABLE;
    payment.releasableAt = new Date();
    await this.payments.save(payment);
    await this.recordEvent(payment.id, from, payment.protectionStatus, 'SYSTEM_SCHEDULER', undefined, 'Order delivered and protection window elapsed with no open dispute');
    return payment;
  }

  /**
   * RELEASABLE -> RELEASED. Acquires the disposition lock, then sends the
   * payout instruction to the licensed partner inside the same DB
   * transaction as the lock write (spec §5).
   */
  async release(paymentId: string, sellerPayoutDestination: Record<string, unknown>): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.getRepository(Payment).findOneByOrFail({ id: paymentId });

      await this.dispositionLock.acquire(
        manager,
        paymentId,
        PaymentProtectionStatus.RELEASABLE,
        PaymentProtectionStatus.RELEASED,
      );

      const idempotencyKey = `payout:${paymentId}:RELEASED`;
      const instructionResult = await this.provider.sendPayoutInstruction({
        idempotencyKey,
        paymentProviderTransactionRef: payment.providerTransactionRef ?? payment.id,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        sellerPayoutDestination,
      });

      await manager.getRepository(Settlement).save(
        manager.getRepository(Settlement).create({
          paymentId,
          kind: SettlementKind.PAYOUT,
          amountMinor: payment.amountMinor,
          idempotencyKey,
          providerInstructionRef: instructionResult.providerInstructionRef,
        }),
      );

      await manager.getRepository(PaymentEvent).save(
        manager.getRepository(PaymentEvent).create({
          paymentId,
          fromStatus: PaymentProtectionStatus.RELEASABLE,
          toStatus: PaymentProtectionStatus.RELEASED,
          actorType: 'SYSTEM_SCHEDULER',
          reason: 'Settlement job sent payout instruction to licensed partner',
        }),
      );

      return manager.getRepository(Payment).findOneByOrFail({ id: paymentId });
    });
  }

  /** REFUND_APPROVED -> REFUNDED, fired by the licensed partner's webhook (terminal, no lock needed — already single-destination). */
  async confirmRefunded(paymentId: string, webhookEventId: string): Promise<Payment> {
    const payment = await this.payments.findOneByOrFail({ id: paymentId });
    if (payment.protectionStatus !== PaymentProtectionStatus.REFUND_APPROVED) return payment;

    const from = payment.protectionStatus;
    payment.protectionStatus = PaymentProtectionStatus.REFUNDED;
    await this.payments.save(payment);
    await this.recordEvent(payment.id, from, payment.protectionStatus, 'PROVIDER_WEBHOOK', webhookEventId, 'Licensed partner confirmed the refund instruction executed');
    return payment;
  }

  /**
   * CANCELLED order (pre-acceptance) -> REFUND_APPROVED. Only reachable
   * while payment is still PROTECTED (spec §3.2) — a cancellation after
   * release is a dispute, not a cancellation.
   */
  async approveRefundForCancellation(paymentId: string, actorType: PaymentEventActorType, actorRef: string): Promise<Payment> {
    const payment = await this.payments.findOneByOrFail({ id: paymentId });
    if (payment.protectionStatus !== PaymentProtectionStatus.PROTECTED) {
      throw new BadRequestException(
        `Cannot cancel-and-refund payment ${paymentId}: it is at ${payment.protectionStatus}, not PROTECTED. A cancellation after release must go through a dispute.`,
      );
    }
    this.assertTransition(payment.protectionStatus, PaymentProtectionStatus.REFUND_APPROVED);
    const from = payment.protectionStatus;
    payment.protectionStatus = PaymentProtectionStatus.REFUND_APPROVED;
    await this.payments.save(payment);
    await this.recordEvent(payment.id, from, payment.protectionStatus, actorType, actorRef, 'Pre-acceptance cancellation; refund approved');

    const idempotencyKey = `refund:${paymentId}:REFUND_APPROVED`;
    const instructionResult = await this.provider.sendRefundInstruction({
      idempotencyKey,
      paymentProviderTransactionRef: payment.providerTransactionRef ?? payment.id,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
    });
    await this.settlements.save(
      this.settlements.create({
        paymentId,
        kind: SettlementKind.REFUND,
        amountMinor: payment.amountMinor,
        idempotencyKey,
        providerInstructionRef: instructionResult.providerInstructionRef,
      }),
    );

    return payment;
  }

  private assertTransition(from: PaymentProtectionStatus, to: PaymentProtectionStatus) {
    if (!isValidPaymentTransition(from, to)) {
      throw new BadRequestException(`Invalid payment-protection transition: ${from} -> ${to}`);
    }
  }

  private async recordEvent(
    paymentId: string,
    fromStatus: PaymentProtectionStatus | undefined,
    toStatus: PaymentProtectionStatus,
    actorType: PaymentEventActorType,
    actorRef: string | undefined,
    reason: string,
  ) {
    await this.paymentEvents.save(
      this.paymentEvents.create({ paymentId, fromStatus, toStatus, actorType, actorRef, reason }),
    );
  }
}
