import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateProductInput, ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() input: CreateProductInput) {
    return this.productsService.create(input);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}
