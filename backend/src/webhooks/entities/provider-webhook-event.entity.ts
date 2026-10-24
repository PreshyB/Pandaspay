import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Stores every inbound webhook with its provider reference id as a unique
 * key, so a duplicate delivery is recognized and discarded before it can
 * re-trigger a transition. Spec §7.
 */
@Entity('provider_webhook_events')
export class ProviderWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  providerName: string;

  /** Unique per provider — the provider's own event/delivery id. */
  @Index({ unique: true })
  @Column()
  providerEventRef: string;

  @Column()
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ default: false })
  processed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @CreateDateColumn()
  receivedAt: Date;
}
