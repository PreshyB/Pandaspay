import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser, CurrentUser, isAdmin, Public } from '../auth/authz';
import { CreateUserInput, UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post()
  create(@Body() input: CreateUserInput) {
    return this.usersService.create(input);
  }

  /** Your own record in full; anyone else's as just a name (used to show who a seller is). */
  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    const found = await this.usersService.findById(id);
    if (!found) return null;
    if (!user || user.id === id || isAdmin(user)) return found;
    return { id: found.id, fullName: found.fullName };
  }
}
