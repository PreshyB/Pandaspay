import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Every outbound instruction to the licensed partner (payout or refund)
 * carries its own idempotency key derived from the transaction id and
 * disposition, so a retried or duplicated instruction-send never results
 * in two real-world transfers. Spec §5 / §7.
 */
@Entity('idempotency_keys')
export class IdempotencyKeyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  key: string;

  /** e.g. 'PAYOUT', 'REFUND' */
  @Column()
  operation: string;

  @Column()
  paymentId: string;

  @Column({ type: 'jsonb', nullable: true })
  responsePayload?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
