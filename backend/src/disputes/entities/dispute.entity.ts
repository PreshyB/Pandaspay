import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Payment } from '../../payments/entities/payment.entity';
import { User } from '../../users/user.entity';

export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED_SELLER = 'RESOLVED_SELLER', // -> RELEASABLE
  RESOLVED_BUYER = 'RESOLVED_BUYER', // -> REFUND_APPROVED
  RESOLVED_SPLIT = 'RESOLVED_SPLIT', // -> PARTIALLY_RESOLVED
}

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Payment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column()
  paymentId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'openedById' })
  openedBy: User;

  @Column()
  openedById: string;

  @Column()
  reason: string;

  @Column({ type: 'text', nullable: true })
  details?: string;

  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  /** For RESOLVED_SPLIT only: the minor-units amount released to the seller. */
  @Column({ type: 'bigint', nullable: true })
  splitReleaseMinor?: string;

  /** For RESOLVED_SPLIT only: the minor-units amount refunded to the buyer. */
  @Column({ type: 'bigint', nullable: true })
  splitRefundMinor?: string;

  @Column({ nullable: true })
  resolvedById?: string;

  @Column({ type: 'text', nullable: true })
  resolutionNotes?: string;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
