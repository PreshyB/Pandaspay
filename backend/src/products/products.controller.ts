import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthUser, assertIs, assertSeller, CurrentUser, Public } from '../auth/authz';
import { CreateProductInput, ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() input: CreateProductInput, @CurrentUser() user?: AuthUser) {
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

  @Public()
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}
