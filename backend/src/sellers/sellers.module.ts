import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { SellersController } from './sellers.controller';

@Module({ imports: [TypeOrmModule.forFeature([User])], controllers: [SellersController] })
export class SellersModule {}
