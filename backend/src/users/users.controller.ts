import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateUserInput, UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() input: CreateUserInput) {
    return this.usersService.create(input);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
