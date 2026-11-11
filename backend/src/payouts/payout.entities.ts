import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Where a seller wants released money sent. Model B: this is just the instruction we hand
 * to the licensed partner, not a wallet. TODO: verify the account name with the partner's
 * name-enquiry API before the first real payout.
 */
@Entity('payout_accounts')
export class PayoutAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  bankName: string;

  @Column({ type: 'varchar' })
  accountName: string;

  @Column({ type: 'varchar' })
  accountNumber: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum PayoutRequestStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** A seller's request to be paid what is eligible. An admin approves before any instruction goes to the partner. */
@Entity('payout_requests')
export class PayoutRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  sellerId: string;

  @Column({ type: 'jsonb' })
  paymentIds: string[];

  @Column({ type: 'bigint' })
  amountMinor: string;

  @Column({ type: 'varchar', default: 'NGN' })
  currency: string;

  @Column({ type: 'varchar', default: PayoutRequestStatus.REQUESTED })
  status: PayoutRequestStatus;

  /** The account details at the time of the request, so a later edit cannot redirect it. */
  @Column({ type: 'jsonb' })
  destination: { bankName: string; accountName: string; accountNumber: string };

  /** Payments that could not be released at approval (for example a dispute opened in the meantime). */
  @Column({ type: 'jsonb', nullable: true })
  skippedPaymentIds?: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  reviewNote?: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewedById?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
