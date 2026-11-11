import { Body, Controller, Get, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser, Public } from './authz';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Public()
  @Post('request-code')
  requestCode(@Body('email') email: string) {
    return this.auth.requestCode(email);
  }

  @Public()
  @Post('verify')
  verify(@Body() body: { email: string; code: string }) {
    return this.auth.verifyCode(body.email, body.code);
  }

  @Get('me')
  async me(@CurrentUser() user?: AuthUser) {
    return user ? this.users.findOneBy({ id: user.id }) : null;
  }
}
