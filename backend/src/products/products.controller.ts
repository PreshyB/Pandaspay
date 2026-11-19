import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthUser, assertIs, assertSeller, CurrentUser, Public } from '../auth/authz';
import { CreateProductDto } from './dto/create-product.dto';
import { MAX_IMAGE_BYTES, ProductImagesService, UploadedImage } from './product-images.service';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productImages: ProductImagesService,
  ) {}

  @Post()
  create(@Body() input: CreateProductDto, @CurrentUser() user?: AuthUser) {
    assertSeller(user);
    assertIs(user, input.sellerId);
    return this.productsService.create(input);
  }

  @Public()
  @Get()
  list(@Query('sellerId') sellerId?: string) {
    if (sellerId) return this.productsService.findBySeller(sellerId);
    return [];
  }

  /** Photos are public: they appear on the shareable product page. Declared before :slug. */
  @Public()
  @Get('images/:imageId')
  async image(@Param('imageId') imageId: string, @Res({ passthrough: true }) res: Response) {
    const { data, contentType } = await this.productImages.getData(imageId);
    // An image id never changes what it shows, so it can be cached for good, and shown on pages from other origins.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return new StreamableFile(data, { type: contentType });
  }

  @Public()
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  private async ownProduct(productId: string, user?: AuthUser) {
    assertSeller(user);
    const product = await this.productImages.productOrFail(productId);
    if (user && user.id !== product.sellerId) throw new ForbiddenException('That product does not belong to your account.');
    return product;
  }

  @Post(':productId/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  async addImage(@Param('productId') productId: string, @UploadedFile() file: UploadedImage | undefined, @CurrentUser() user?: AuthUser) {
    await this.ownProduct(productId, user);
    return this.productImages.add(productId, file);
  }

  @Delete(':productId/images/:imageId')
  async removeImage(@Param('productId') productId: string, @Param('imageId') imageId: string, @CurrentUser() user?: AuthUser) {
    await this.ownProduct(productId, user);
    await this.productImages.remove(productId, imageId);
    return { ok: true };
  }

  @Patch(':productId/images/:imageId/cover')
  async makeCover(@Param('productId') productId: string, @Param('imageId') imageId: string, @CurrentUser() user?: AuthUser) {
    await this.ownProduct(productId, user);
    await this.productImages.makeCover(productId, imageId);
    return { ok: true };
  }
}
