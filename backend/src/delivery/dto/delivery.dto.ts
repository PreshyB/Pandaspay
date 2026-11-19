import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { DeliverySpeed, DeliveryZone } from '../delivery-option.entity';

export class StoreLocationDto {
  @IsString()
  @Length(2, 60)
  storeState: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  storeCity?: string;
}

export class DeliveryOptionDto {
  @IsUUID()
  sellerId: string;

  @IsEnum(DeliveryZone)
  zone: DeliveryZone;

  @IsEnum(DeliverySpeed)
  speed: DeliverySpeed;

  /** Whole kobo, as a number or numeric string. */
  @Transform(({ value }) => (typeof value === 'number' ? String(value) : value))
  @Matches(/^\d{1,12}$/, { message: 'Enter the delivery fee as a whole amount.' })
  feeMinor: string;

  @IsInt()
  @Min(1)
  @Max(120)
  minHours: number;

  @IsInt()
  @Min(1)
  @Max(120)
  maxHours: number;
}
