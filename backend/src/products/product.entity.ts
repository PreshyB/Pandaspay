import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ProductSku } from './product-sku.entity';

export interface ProductOption {
  /** e.g. "Colour", "Size", "Model" */
  name: string;
  values: string[];
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column()
  sellerId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Minor units (e.g. kobo) to avoid float rounding on money. */
  @Column({ type: 'bigint' })
  priceMinor: string;

  @Column({ default: 'NGN' })
  currency: string;

  @Column({ type: 'varchar', nullable: true })
  brand?: string;

  /**
   * Seller-defined choices the buyer must make (colour, size, model...).
   * Stock is still tracked per product, not per combination; SKU-level
   * stock (blueprint §5.3) is the next step.
   */
  @Column({ type: 'jsonb', nullable: true })
  options?: ProductOption[];

  /** Legacy whole-product stock. When a product has SKUs, their stock is the truth. */
  @Column({ default: 0 })
  stockQuantity: number;

  @OneToMany(() => ProductSku, (sku) => sku.product, { eager: true, cascade: ['insert'] })
  skus: ProductSku[];

  /** The unique shareable product link slug (per blueprint §1.1). */
  @Column({ unique: true })
  slug: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
