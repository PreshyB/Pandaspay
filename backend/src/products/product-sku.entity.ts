import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';

/**
 * One purchasable combination of a product's options (e.g. Black / 42) with
 * its own stock (blueprint: SKU-level inventory). Orders reserve stock from
 * the SKU atomically, so a combination can never be oversold.
 */
@Entity('product_skus')
@Index(['productId'])
export class ProductSku {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, (product) => product.skus, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  productId: string;

  /** Option name -> chosen value, e.g. { Colour: 'Black', Size: '42' }. */
  @Column({ type: 'jsonb' })
  attributes: Record<string, string>;

  @Column({ default: 0 })
  stockQuantity: number;
}
