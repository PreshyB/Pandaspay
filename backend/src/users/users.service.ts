import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

export interface CreateUserInput {
  email: string;
  fullName: string;
  phone?: string;
  roles?: UserRole[];
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  create(input: CreateUserInput): Promise<User> {
    const user = this.users.create({ ...input, roles: input.roles ?? [UserRole.BUYER] });
    return this.users.save(user);
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }
}
