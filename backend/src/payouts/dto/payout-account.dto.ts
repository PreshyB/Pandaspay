import { IsString, Length, Matches } from 'class-validator';

export class PayoutAccountDto {
  @IsString()
  @Length(2, 80)
  bankName: string;

  @IsString()
  @Length(2, 120)
  accountName: string;

  @IsString()
  @Matches(/^[\d\s]{10,14}$/, { message: 'A Nigerian account number has 10 digits.' })
  accountNumber: string;
}
