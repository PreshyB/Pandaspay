import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../products/product.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  productId: string;

  @Column()
  quantity: number;

  /** Price at time of purchase, in minor units — never re-read from Product later. */
  @Column({ type: 'bigint' })
  unitPriceMinor: string;

  /** The SKU whose stock this line reserved, if the product has SKUs. */
  @Column({ type: 'varchar', nullable: true })
  skuId?: string;

  @Column({ type: 'jsonb', nullable: true })
  variant?: Record<string, unknown>;
}
