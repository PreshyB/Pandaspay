import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { DeliveryOption } from './delivery-option.entity';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryOption, User])],
  providers: [DeliveryService],
  controllers: [DeliveryController],
  exports: [TypeOrmModule],
})
export class DeliveryModule {}
