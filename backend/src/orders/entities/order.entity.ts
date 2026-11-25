import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { OrderItem } from './order-item.entity';
import { Payment } from '../../payments/entities/payment.entity';

/**
 * The order (fulfillment) track. See OrderStatus for the state machine.
 * Never stores payment/protection status here — that lives on Payment,
 * on purpose, per the state-machine spec §1 (two independent tracks).
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @Column()
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column()
  sellerId: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.CREATED })
  status: OrderStatus;

  @Column({ type: 'bigint' })
  totalMinor: string;

  @Column({ default: 'NGN' })
  currency: string;

  @Column({ type: 'jsonb', nullable: true })
  deliveryAddress?: Record<string, unknown>;

  /** Delivery charged on this order, minor units. Set by the server from the seller's chosen option. */
  @Column({ type: 'bigint', default: 0 })
  deliveryFeeMinor: string;

  /** Snapshot of the option the buyer agreed to, so later edits by the seller never rewrite it. */
  @Column({ type: 'jsonb', nullable: true })
  deliveryOption?: {
    zone: string;
    speed: string;
    feeMinor: string;
    minHours: number;
    maxHours: number;
  };

  @Column({ type: 'timestamptz', nullable: true })
  shippedAt?: Date;

  /** shippedAt + the promised maximum window. Estimate, not a guarantee. */
  @Column({ type: 'timestamptz', nullable: true })
  expectedDeliveryBy?: Date;

  /** Which of the three sources fired SHIPPED/IN_TRANSIT → DELIVERED (spec §2.2). */
  @Column({ nullable: true })
  deliveryConfirmedBy?: 'BUYER' | 'COURIER' | 'AUTO_TIMEOUT';

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  @OneToOne(() => Payment, (payment) => payment.order)
  payment: Payment;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
