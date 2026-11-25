import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only record of sensitive administrative actions (blueprint Part 26, guardrail 5). */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  actorId: string;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'varchar' })
  targetType: string;

  @Column({ type: 'varchar' })
  targetId: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
