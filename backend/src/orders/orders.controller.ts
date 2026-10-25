import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Get()
  list(@Query('buyerId') buyerId?: string, @Query('sellerId') sellerId?: string) {
    if (buyerId) return this.ordersService.findForBuyer(buyerId);
    if (sellerId) return this.ordersService.findForSeller(sellerId);
    return [];
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string) {
    return this.ordersService.sellerAccept(id);
  }

  @Patch(':id/decline')
  decline(@Param('id') id: string, @Body('actorId') actorId: string) {
    return this.ordersService.declineOrCancel(id, 'SELLER', actorId);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body('actorId') actorId: string) {
    return this.ordersService.declineOrCancel(id, 'BUYER', actorId);
  }

  @Patch(':id/ship')
  ship(@Param('id') id: string, @Body('waybillRef') waybillRef: string) {
    return this.ordersService.markShipped(id, waybillRef);
  }

  @Patch(':id/in-transit')
  inTransit(@Param('id') id: string) {
    return this.ordersService.markInTransit(id);
  }

  @Patch(':id/delivered')
  delivered(@Param('id') id: string, @Body('confirmedBy') confirmedBy: 'BUYER' | 'COURIER' | 'AUTO_TIMEOUT') {
    return this.ordersService.confirmDelivered(id, confirmedBy);
  }

  @Patch(':id/delivery-failed')
  deliveryFailed(@Param('id') id: string) {
    return this.ordersService.markDeliveryFailed(id);
  }

  @Patch(':id/reattempt')
  reattempt(@Param('id') id: string) {
    return this.ordersService.scheduleReattempt(id);
  }

  @Patch(':id/returned')
  returned(@Param('id') id: string) {
    return this.ordersService.markReturned(id);
  }
}
