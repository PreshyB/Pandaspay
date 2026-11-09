import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
