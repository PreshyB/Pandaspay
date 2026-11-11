import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
}

export enum SellerStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface SellerApplication {
  businessName: string;
  socialLink?: string;
  note?: string;
  submittedAt: string;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone?: string;

  @Column()
  fullName: string;

  /** Seller's registered store location. Delivery zones are named from the state. */
  @Column({ type: 'varchar', nullable: true })
  storeState?: string;

  @Column({ type: 'varchar', nullable: true })
  storeCity?: string;

  @Column({ type: 'simple-array', default: UserRole.BUYER })
  roles: UserRole[];

  @Column({ nullable: true })
  passwordHash?: string;

  /** Seller activation: NONE -> PENDING (applied) -> APPROVED or REJECTED (admin). SELLER role is added only on approval. */
  @Column({ type: 'varchar', default: SellerStatus.NONE })
  sellerStatus: SellerStatus;

  @Column({ type: 'jsonb', nullable: true })
  sellerApplication?: SellerApplication | null;

  @Column({ type: 'varchar', nullable: true })
  sellerReviewNote?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sellerReviewedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
