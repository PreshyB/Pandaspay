import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/product.entity';
import { DeliveryOption } from '../delivery/delivery-option.entity';
import { User } from '../users/user.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product, DeliveryOption, User]), PaymentsModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
