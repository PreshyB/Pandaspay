import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Length(1, 120)
  fullName: string;

  @IsOptional()
  @Matches(/^[+\d\s-]{7,20}$/, { message: 'Enter a valid phone number.' })
  phone?: string;
}
