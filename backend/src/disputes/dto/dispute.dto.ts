import { IsObject, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

export class OpenDisputeDto {
  @IsUUID()
  paymentId: string;

  /** Only used while sign-in is not enforced and no token is sent. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  openedById?: string;

  @IsString()
  @Length(3, 200)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}

export class ResolveDisputeDto {
  /** Only used while sign-in is not enforced and no token is sent. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resolvedById?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ResolveSplitDto extends ResolveDisputeDto {
  @IsString()
  @Matches(/^[1-9]\d{0,17}$/, { message: 'Enter a positive whole amount for the seller.' })
  releaseMinor: string;

  @IsString()
  @Matches(/^[1-9]\d{0,17}$/, { message: 'Enter a positive whole amount for the buyer.' })
  refundMinor: string;

  @IsObject()
  sellerPayoutDestination: Record<string, unknown>;
}
