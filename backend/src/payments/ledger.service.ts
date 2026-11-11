import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PaymentProtectionStatus as S } from '../common/enums/payment-protection-status.enum';
import { FinancialTransaction, FinancialTransactionType } from './financial-transaction.entity';
import { Payment } from './entities/payment.entity';
import { Settlement, SettlementKind } from './entities/settlement.entity';

@Injectable()
export class LedgerService {
  constructor(private readonly dataSource: DataSource) {}

  /** Records an event once. Pass the transaction's manager so it commits with the status change. */
  async record(
    entry: { paymentId: string; type: FinancialTransactionType; amountMinor: string; currency: string; reference: string },
    manager?: EntityManager,
  ): Promise<void> {
    await (manager ?? this.dataSource.manager)
      .getRepository(FinancialTransaction)
      .createQueryBuilder()
      .insert()
      .values(entry)
      .orIgnore()
      .execute();
  }

  /**
   * Checks BuyBridge's three records agree: the payment status, the settlement instructions, and the ledger.
   * It cannot yet compare with the partner's own statement (no partner is connected), so a clean report means
   * our books are consistent, not that the bank balance matches.
   */
  async reconcile() {
    const payments = await this.dataSource.getRepository(Payment).find();
    const settlements = await this.dataSource.getRepository(Settlement).find();
    const ledger = await this.dataSource.getRepository(FinancialTransaction).find();

    const sum = (rows: Array<{ amountMinor: string }>) => rows.reduce((n, r) => n + BigInt(r.amountMinor), BigInt(0));
    const notYetPaid = [S.AWAITING_PAYMENT, S.PAYMENT_DECLINED];
    const issues: Array<{ paymentId: string; problem: string }> = [];
    const totals = { receivedMinor: BigInt(0), payoutInstructedMinor: BigInt(0), refundInstructedMinor: BigInt(0) };

    for (const p of payments) {
      const amount = BigInt(p.amountMinor);
      const mine = settlements.filter((x) => x.paymentId === p.id);
      const payout = sum(mine.filter((x) => x.kind === SettlementKind.PAYOUT));
      const refund = sum(mine.filter((x) => x.kind === SettlementKind.REFUND));
      const led = ledger.filter((x) => x.paymentId === p.id);
      const ledReceived = sum(led.filter((x) => x.type === FinancialTransactionType.PAYMENT_RECEIVED));
      const ledPayout = sum(led.filter((x) => x.type === FinancialTransactionType.PAYOUT_INSTRUCTED));
      const ledRefund = sum(led.filter((x) => x.type === FinancialTransactionType.REFUND_INSTRUCTED));
      totals.receivedMinor += ledReceived;
      totals.payoutInstructedMinor += ledPayout;
      totals.refundInstructedMinor += ledRefund;

      const bad = (problem: string) => issues.push({ paymentId: p.id, problem });
      if (notYetPaid.includes(p.protectionStatus)) {
        if (ledReceived !== BigInt(0)) bad('Ledger shows money received but the payment is not marked paid');
        if (payout + refund !== BigInt(0)) bad('Instructions exist for an unpaid payment');
        continue;
      }
      if (ledReceived !== amount) bad(`Ledger received ${ledReceived} but the payment is ${amount}`);
      if (payout !== ledPayout) bad(`Payout instructions (${payout}) do not match the ledger (${ledPayout})`);
      if (refund !== ledRefund) bad(`Refund instructions (${refund}) do not match the ledger (${ledRefund})`);
      if (payout + refund > amount) bad('More has been instructed out than was received');

      const expected: Partial<Record<S, [bigint, bigint]>> = {
        [S.PROTECTED]: [BigInt(0), BigInt(0)],
        [S.DISPUTED]: [BigInt(0), BigInt(0)],
        [S.RELEASABLE]: [BigInt(0), BigInt(0)],
        [S.RELEASED]: [amount, BigInt(0)],
        [S.REFUND_APPROVED]: [BigInt(0), amount],
        [S.REFUNDED]: [BigInt(0), amount],
      };
      const e = expected[p.protectionStatus];
      if (e && (payout !== e[0] || refund !== e[1])) bad(`Status ${p.protectionStatus} does not match the instructions sent (payout ${payout}, refund ${refund})`);
      if (p.protectionStatus === S.PARTIALLY_RESOLVED && payout + refund !== amount) bad('A split must send out exactly the amount received');
    }

    return {
      checkedPayments: payments.length,
      clean: issues.length === 0,
      issues,
      totals: {
        receivedMinor: totals.receivedMinor.toString(),
        payoutInstructedMinor: totals.payoutInstructedMinor.toString(),
        refundInstructedMinor: totals.refundInstructedMinor.toString(),
        stillHeldMinor: (totals.receivedMinor - totals.payoutInstructedMinor - totals.refundInstructedMinor).toString(),
      },
    };
  }
}
