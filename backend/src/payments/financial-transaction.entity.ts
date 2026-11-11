import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum FinancialTransactionType {
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED', // partner confirmed buyer money is in the designated account
  PAYOUT_INSTRUCTED = 'PAYOUT_INSTRUCTED', // instruction sent to the partner to pay a seller
  REFUND_INSTRUCTED = 'REFUND_INSTRUCTED', // instruction sent to the partner to refund a buyer
}

/**
 * BuyBridge's own append-only record of financial events (Model B: an operational and audit
 * record, not a balance). Rows are never updated or deleted. The unique (type, reference)
 * pair makes writing the same event twice a no-op, so retries and redelivered webhooks are safe.
 */
@Entity('financial_transactions')
@Index(['type', 'reference'], { unique: true })
export class FinancialTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  paymentId: string;

  @Column({ type: 'enum', enum: FinancialTransactionType })
  type: FinancialTransactionType;

  @Column({ type: 'bigint' })
  amountMinor: string;

  @Column({ type: 'varchar', default: 'NGN' })
  currency: string;

  /** The instruction idempotency key, or a stable key for the event. */
  @Column({ type: 'varchar' })
  reference: string;

  @CreateDateColumn()
  createdAt: Date;
}
