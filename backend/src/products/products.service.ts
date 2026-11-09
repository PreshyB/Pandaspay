import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Product, ProductOption } from './product.entity';

export interface CreateProductInput {
  sellerId: string;
  title: string;
  description?: string;
  priceMinor: string;
  currency?: string;
  stockQuantity?: number;
  brand?: string;
  options?: ProductOption[];
}

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private readonly products: Repository<Product>) {}

  async create(input: CreateProductInput): Promise<Product> {
    const options = (input.options ?? [])
      .map((o) => ({
        name: String(o?.name ?? '').trim().slice(0, 40),
        values: Array.from(new Set((o?.values ?? []).map((v) => String(v).trim().slice(0, 40)).filter(Boolean))).slice(0, 20),
      }))
      .filter((o) => o.name && o.values.length > 0)
      .slice(0, 5);
    const product = this.products.create({
      ...input,
      brand: input.brand?.trim() || undefined,
      options: options.length ? options : undefined,
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
