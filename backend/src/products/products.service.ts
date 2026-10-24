import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Product } from './product.entity';

export interface CreateProductInput {
  sellerId: string;
  title: string;
  description?: string;
  priceMinor: string;
  currency?: string;
  stockQuantity?: number;
}

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private readonly products: Repository<Product>) {}

  async create(input: CreateProductInput): Promise<Product> {
    const product = this.products.create({
      ...input,
      currency: input.currency ?? 'NGN',
      stockQuantity: input.stockQuantity ?? 0,
      slug: randomUUID().slice(0, 8),
    });
    return this.products.save(product);
  }

  findBySlug(slug: string): Promise<Product | null> {
    return this.products.findOneBy({ slug });
  }

  findBySeller(sellerId: string): Promise<Product[]> {
    return this.products.findBy({ sellerId });
  }
}
