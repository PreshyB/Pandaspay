import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductImage } from './product-image.entity';
import { ProductImagesService } from './product-images.service';
import { ProductSku } from './product-sku.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductSku, ProductImage])],
  providers: [ProductsService, ProductImagesService],
  controllers: [ProductsController],
  exports: [TypeOrmModule],
})
export class ProductsModule {}
