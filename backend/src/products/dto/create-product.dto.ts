import { IsArray, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';

/** Perimeter checks only. The service validates options and SKU combinations in depth. */
export class CreateProductDto {
  @IsUUID()
  sellerId: string;

  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsString()
  @Matches(/^[1-9]\d{0,14}$/, { message: 'Enter a price greater than zero.' })
  priceMinor: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stockQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsArray()
  options?: { name: string; values: string[] }[];

  @IsOptional()
  @IsArray()
  skus?: { attributes: Record<string, string>; stockQuantity: number }[];
}
