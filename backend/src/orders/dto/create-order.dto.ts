import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class OrderItemDto {
  @IsUUID()
  productId: string;

  quantity: number;

  @IsOptional()
  variant?: Record<string, unknown>;
}

export class CreateOrderDto {
  @IsUUID()
  buyerId: string;

  @IsUUID()
  sellerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsUUID()
  deliveryOptionId?: string;

  @IsOptional()
  deliveryAddress?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  currency?: string;
}
