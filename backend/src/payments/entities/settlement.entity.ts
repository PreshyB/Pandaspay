import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Payment } from './payment.entity';

export enum SettlementKind {
  PAYOUT = 'PAYOUT', // -> seller
  REFUND = 'REFUND', // -> buyer
}

export enum SettlementExecutionStatus {
  INSTRUCTION_SENT = 'INSTRUCTION_SENT',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
}

/**
 * An outbound instruction to the licensed partner (payout or refund).
 * A PARTIALLY_RESOLVED disposition produces two linked Settlement rows
 * (one PAYOUT, one REFUND) sharing `dispositionGroupId`, written and sent
 * together under one disposition lock acquisition (spec §5).
 */
@Entity('settlements')
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Payment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column()
  paymentId: string;

  @Column({ type: 'enum', enum: SettlementKind })
  kind: SettlementKind;

  @Column({ type: 'bigint' })
  amountMinor: string;

  @Column({ unique: true })
  idempotencyKey: string;

  @Column({ type: 'enum', enum: SettlementExecutionStatus, default: SettlementExecutionStatus.INSTRUCTION_SENT })
  executionStatus: SettlementExecutionStatus;

  /** Groups the two linked instructions of a PARTIALLY_RESOLVED disposition. Null otherwise. */
  @Column({ nullable: true })
  dispositionGroupId?: string;

  @Column({ nullable: true })
  providerInstructionRef?: string;

  @Column({ type: 'timestamptz', nullable: true })
  executedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
