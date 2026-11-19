import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';

/**
 * A product photo. The bytes live in Postgres for now (the browser shrinks every photo before upload, so
 * each is a few hundred KB), which keeps the app self-contained. Move to object storage (S3, Cloudinary)
 * before volume grows; only ProductImagesService needs to change.
 */
@Entity('product_images')
export class ProductImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, (p) => p.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Index()
  @Column()
  productId: string;

  @Column({ type: 'varchar' })
  contentType: string;

  /** Never loaded with the product: it is read only by the image endpoint. */
  @Column({ type: 'bytea', select: false })
  data: Buffer;

  @Column({ type: 'int' })
  sizeBytes: number;

  /** Lowest position is the cover photo. */
  @Column({ type: 'int', default: 0 })
  position: number;

  @CreateDateColumn()
  createdAt: Date;
}
