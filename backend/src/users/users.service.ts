import { ConflictException, Injectable } from '@nestjs/common';
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

  async create(input: CreateUserInput): Promise<User> {
    const user = this.users.create({ ...input, roles: input.roles ?? [UserRole.BUYER] });
    try {
      return await this.users.save(user);
    } catch (err) {
      // Postgres unique_violation on users.email
      const e = err as { code?: string; driverError?: { code?: string } };
      if (e.code === '23505' || e.driverError?.code === '23505') {
        throw new ConflictException('An account with this email already exists.');
      }
      throw err;
    }
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }
}
