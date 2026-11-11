import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { Product, ProductOption } from './product.entity';
import { ProductSku } from './product-sku.entity';

export interface CreateProductInput {
  sellerId: string;
  title: string;
  description?: string;
  priceMinor: string;
  currency?: string;
  stockQuantity?: number;
  brand?: string;
  options?: ProductOption[];
  /** One entry per option combination, each with its own stock. */
  skus?: { attributes: Record<string, string>; stockQuantity: number }[];
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
    const skus: Partial<ProductSku>[] = [];
    if (options.length && input.skus?.length) {
      const seen = new Set<string>();
      for (const s of input.skus) {
        const attributes: Record<string, string> = {};
        for (const o of options) {
          const v = s.attributes?.[o.name];
          if (typeof v !== 'string' || !o.values.includes(v)) {
            throw new BadRequestException(`Each stock row needs a valid ${o.name}`);
          }
          attributes[o.name] = v;
        }
        const key = JSON.stringify(attributes);
        if (seen.has(key)) throw new BadRequestException('Two stock rows have the same choices');
        seen.add(key);
        const stock = Number(s.stockQuantity);
        if (!Number.isInteger(stock) || stock < 0) throw new BadRequestException('Stock must be zero or more');
        skus.push({ attributes, stockQuantity: stock });
      }
    }
    const product = this.products.create({
      ...input,
      skus: skus as ProductSku[],
      stockQuantity: skus.length ? skus.reduce((n, s) => n + (s.stockQuantity ?? 0), 0) : input.stockQuantity ?? 0,
      brand: input.brand?.trim() || undefined,
      options: options.length ? options : undefined,
      currency: input.currency ?? 'NGN',
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
