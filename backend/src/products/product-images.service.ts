import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductImage } from './product-image.entity';
import { Product } from './product.entity';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 8;

export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

/** Works out the real type from the file's first bytes. The client-supplied type and file name are never trusted. */
export function sniffImageType(b: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

@Injectable()
export class ProductImagesService {
  constructor(
    @InjectRepository(ProductImage) private readonly images: Repository<ProductImage>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  /** The product, so the controller can check the caller owns it. */
  async productOrFail(productId: string): Promise<Product> {
    const product = await this.products.findOneBy({ id: productId });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  async add(productId: string, file: UploadedImage | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a photo to upload.');
    if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException('That photo is too large. The limit is 5 MB.');
    const contentType = sniffImageType(file.buffer);
    if (!contentType) throw new BadRequestException('Use a JPG, PNG or WebP photo.');

    const count = await this.images.countBy({ productId });
    if (count >= MAX_IMAGES_PER_PRODUCT) {
      throw new BadRequestException(`A product can have up to ${MAX_IMAGES_PER_PRODUCT} photos.`);
    }
    const last = await this.images.maximum('position', { productId });
    const saved = await this.images.save(
      this.images.create({ productId, contentType, data: file.buffer, sizeBytes: file.buffer.length, position: (last ?? -1) + 1 }),
    );
    return { id: saved.id, productId, contentType, sizeBytes: saved.sizeBytes, position: saved.position };
  }

  async remove(productId: string, imageId: string) {
    const r = await this.images.delete({ id: imageId, productId });
    if (!r.affected) throw new NotFoundException('Photo not found.');
  }

  /** Makes this photo the cover by putting it ahead of every other one. */
  async makeCover(productId: string, imageId: string) {
    const image = await this.images.findOneBy({ id: imageId, productId });
    if (!image) throw new NotFoundException('Photo not found.');
    const first = await this.images.minimum('position', { productId });
    await this.images.update({ id: imageId }, { position: (first ?? 0) - 1 });
  }

  async getData(imageId: string): Promise<{ data: Buffer; contentType: string }> {
    const row = await this.images
      .createQueryBuilder('i')
      .addSelect('i.data')
      .where('i.id = :imageId', { imageId })
      .getOne();
    if (!row) throw new NotFoundException('Photo not found.');
    return { data: row.data, contentType: row.contentType };
  }
}
