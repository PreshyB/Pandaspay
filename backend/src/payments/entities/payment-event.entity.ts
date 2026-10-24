import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Payment } from './payment.entity';
import { PaymentProtectionStatus } from '../../common/enums/payment-protection-status.enum';

export type PaymentEventActorType = 'BUYER' | 'SELLER' | 'ADMIN' | 'SYSTEM_SCHEDULER' | 'PROVIDER_WEBHOOK';

/**
 * Audit trail of every payment-status transition, per spec §7:
 * "Every write that changes ... payment status is wrapped with the actor
 * and reason it recorded — this is what lets the admin dispute/audit
 * screens explain 'why is this transaction in this state' without guessing."
 */
@Entity('payment_events')
export class PaymentEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Index()
  @Column()
  paymentId: string;

  @Column({ type: 'enum', enum: PaymentProtectionStatus, nullable: true })
  fromStatus?: PaymentProtectionStatus;

  @Column({ type: 'enum', enum: PaymentProtectionStatus })
  toStatus: PaymentProtectionStatus;

  @Column()
  actorType: PaymentEventActorType;

  /** User id for BUYER/SELLER/ADMIN; webhook/job id for PROVIDER_WEBHOOK/SYSTEM_SCHEDULER. */
  @Column({ nullable: true })
  actorRef?: string;

  @Column()
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}
