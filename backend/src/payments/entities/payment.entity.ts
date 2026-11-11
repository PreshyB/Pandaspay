import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { PaymentProtectionStatus } from '../../common/enums/payment-protection-status.enum';

/**
 * The payment / protection track (spec §3). One row per order.
 *
 * Model B (Fund Custody & Settlement Model): the licensed partner holds
 * the money in its designated/collection account. This row never
 * represents BuyBridge holding or owning funds — it is the operational
 * mirror of what happened at the partner, plus BuyBridge's own
 * protection-window / dispute / disposition bookkeeping.
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Order, (order) => order.payment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Index({ unique: true })
  @Column()
  orderId: string;

  @Column({
    type: 'enum',
    enum: PaymentProtectionStatus,
    default: PaymentProtectionStatus.AWAITING_PAYMENT,
  })
  protectionStatus: PaymentProtectionStatus;

  @Column({ type: 'bigint' })
  amountMinor: string;

  @Column({ default: 'NGN' })
  currency: string;

  /** Which licensed partner (provider) holds this payment under Model B. */
  @Column()
  providerName: string;

  /** The provider's own reference for this payment — used for idempotency. */
  @Column({ nullable: true })
  @Index()
  providerTransactionRef?: string;

  /** Buyer-facing idempotency key for the payment attempt itself (spec §3.2). */
  @Column({ unique: true })
  attemptIdempotencyKey: string;

  /** Set once the order's DELIVERED event + protection window determine eligibility. */
  @Column({ type: 'timestamptz', nullable: true })
  releasableAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  protectedAt?: Date;

  /**
   * Optimistic-locking version column — backs the compare-and-swap used by
   * the disposition lock (spec §5) alongside the explicit status guard in
   * the UPDATE ... WHERE status = ? clause.
   */
  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
