import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/** Where the buyer is, relative to the seller's registered store state. */
export enum DeliveryZone {
  WITHIN_STATE = 'WITHIN_STATE',
  OUTSIDE_STATE = 'OUTSIDE_STATE',
}

export enum DeliverySpeed {
  STANDARD = 'STANDARD',
  EXPRESS = 'EXPRESS',
}

/**
 * One seller-defined delivery promise: a zone x speed with the seller's own
 * fee and time window (wireflow "Seller: Delivery & shipping setup").
 * Zone and speed are separate choices, so Express is an add-on within a zone.
 * Pausing (isActive=false) keeps the setup but makes it unavailable to buyers.
 */
@Entity('delivery_options')
@Index(['sellerId', 'zone', 'speed'], { unique: true })
export class DeliveryOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column()
  sellerId: string;

  @Column({ type: 'enum', enum: DeliveryZone })
  zone: DeliveryZone;

  @Column({ type: 'enum', enum: DeliverySpeed })
  speed: DeliverySpeed;

  /** Minor units. 0 means free delivery. Entirely the seller's decision. */
  @Column({ type: 'bigint', default: 0 })
  feeMinor: string;

  /** The promised window, in hours (the buyer sees and agrees to this exact range). */
  @Column()
  minHours: number;

  @Column()
  maxHours: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
