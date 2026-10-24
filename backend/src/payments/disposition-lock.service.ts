import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentProtectionStatus } from '../common/enums/payment-protection-status.enum';

/**
 * Implements the disposition lock from the state-machine spec §5:
 *
 * "A protection transaction has exactly one terminal financial
 * disposition: RELEASED, REFUNDED, or PARTIALLY_RESOLVED. It must never
 * receive two. ... Mechanism: the transition into any terminal
 * disposition is a single conditional write — a compare-and-swap against
 * the transaction's current payment status (e.g. `update ... set status =
 * 'RELEASED' where id = ? and status = 'RELEASABLE'`), performed inside
 * the same database transaction as the outbound instruction record.
 * Whichever process's write affects zero rows has lost the race, must not
 * send a payout or refund instruction to the licensed partner, and logs a
 * disposition conflict for audit rather than silently retrying."
 *
 * Callers pass the single expected "from" status (RELEASABLE or DISPUTED)
 * and the terminal "to" status. The UPDATE ... WHERE id = ? AND status = ?
 * is the actual lock; TypeORM's affected-row count tells us who won.
 */
@Injectable()
export class DispositionLockService {
  private readonly logger = new Logger(DispositionLockService.name);

  /**
   * Attempts the compare-and-swap. Must be called with an EntityManager
   * that is already inside a transaction, so the status write and the
   * caller's outbound-instruction record commit atomically together.
   *
   * Throws ConflictException if another process already won the race —
   * callers must not send any payout/refund instruction in that case.
   */
  async acquire(
    manager: EntityManager,
    paymentId: string,
    expectedFromStatus: PaymentProtectionStatus,
    toStatus: PaymentProtectionStatus,
  ): Promise<void> {
    const result = await manager
      .createQueryBuilder()
      .update(Payment)
      .set({ protectionStatus: toStatus })
      .where('id = :paymentId', { paymentId })
      .andWhere('"protectionStatus" = :expectedFromStatus', { expectedFromStatus })
      .execute();

    const affected = result.affected ?? 0;

    if (affected === 0) {
      this.logger.warn(
        `Disposition conflict: payment=${paymentId} expectedFrom=${expectedFromStatus} wanted=${toStatus} — lock lost, no instruction will be sent`,
      );
      throw new ConflictException(
        `Payment ${paymentId} is no longer at ${expectedFromStatus}; another process already settled its disposition. No instruction was sent.`,
      );
    }
  }
}
