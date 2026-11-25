import { IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class ApplyToSellDto {
  /** Only used while sign-in is not enforced and no token is sent. */
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  @Length(2, 100)
  businessName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  socialLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsString()
  @Length(2, 60)
  storeState: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  storeCity?: string;
}
