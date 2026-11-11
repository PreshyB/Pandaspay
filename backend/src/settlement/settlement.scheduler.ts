import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { Payment } from '../payments/entities/payment.entity';
import { PaymentProtectionStatus } from '../common/enums/payment-protection-status.enum';
import { PaymentsService, PROTECTION_WINDOW_HOURS } from '../payments/payments.service';

/**
 * The "settlement job" referenced throughout the state-machine spec:
 * - sweeps DELIVERED orders whose protection window has elapsed with no
 *   open dispute, and moves their payment PROTECTED -> RELEASABLE (§4);
 * - sweeps RELEASABLE payments and sends the payout instruction,
 *   RELEASABLE -> RELEASED, through the disposition lock (§5).
 *
 * Both sweeps are deliberately separate passes so a late-opened dispute
 * between "window elapsed" and "payout instruction sent" is still caught
 * by the RELEASABLE -> DISPUTED race path, not raced past.
 */
@Injectable()
export class SettlementScheduler {
  private readonly logger = new Logger(SettlementScheduler.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepReleasable(): Promise<void> {
    const cutoff = new Date(Date.now() - PROTECTION_WINDOW_HOURS * 60 * 60 * 1000);

    const deliveredOrders = await this.orders.find({
      where: { status: OrderStatus.DELIVERED, deliveredAt: LessThanOrEqual(cutoff) },
      relations: ['payment'],
    });

    for (const order of deliveredOrders) {
      if (order.payment?.protectionStatus === PaymentProtectionStatus.PROTECTED) {
        try {
          await this.paymentsService.markReleasable(order.payment.id);
          this.logger.log(`payment=${order.payment.id} order=${order.id} -> RELEASABLE`);
        } catch (err) {
          this.logger.error(`Failed to mark payment=${order.payment.id} releasable`, err as Error);
        }
      }
    }
  }

  /**
   * Automatic payout is OFF by default: sellers request a payout and an admin approves it
   * (PayoutsService). Set AUTO_PAYOUT=true to restore the old behaviour for local testing.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepRelease(): Promise<void> {
    if (process.env.AUTO_PAYOUT !== 'true') return;
    const releasable = await this.payments.find({
      where: { protectionStatus: PaymentProtectionStatus.RELEASABLE },
      relations: ['order', 'order.seller'],
    });

    for (const payment of releasable) {
      try {
        // Placeholder payout destination until seller payout-method storage
        // exists; the real shape will come from the chosen Model B partner's API.
        await this.paymentsService.release(payment.id, { sellerId: payment.order?.sellerId });
        this.logger.log(`payment=${payment.id} -> RELEASED (payout instruction sent)`);
      } catch (err) {
        // ConflictException means another process (e.g. a dispute opening
        // concurrently) won the disposition lock — expected, not an error.
        this.logger.warn(`Skipped release for payment=${payment.id}: ${(err as Error).message}`);
      }
    }
  }
}
