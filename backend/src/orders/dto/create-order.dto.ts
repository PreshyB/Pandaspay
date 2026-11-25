import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';

export class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @IsOptional()
  @IsObject()
  variant?: Record<string, unknown>;
}

export class CreateOrderDto {
  @IsUUID()
  buyerId: string;

  @IsUUID()
  sellerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsUUID()
  deliveryOptionId?: string;

  @IsOptional()
  @IsObject()
  deliveryAddress?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
