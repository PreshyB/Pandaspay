import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class RequestCodeDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class VerifyCodeDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'The code is 6 digits.' })
  code: string;
}
