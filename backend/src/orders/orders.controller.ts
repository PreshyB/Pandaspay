import { ForbiddenException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, assertIs, assertSelf, CurrentUser, isAdmin } from '../auth/authz';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Loads the order and checks the caller is the right party. Admins can read but not act. */
  private async forParty(id: string, user: AuthUser | undefined, who: 'buyer' | 'seller' | 'either', write = true): Promise<Order> {
    const order = await this.ordersService.findById(id);
    if (!user) return order;
    const isBuyer = user.id === order.buyerId;
    const isSeller = user.id === order.sellerId;
    const ok = who === 'buyer' ? isBuyer : who === 'seller' ? isSeller : isBuyer || isSeller;
    if (!ok && !(!write && isAdmin(user))) throw new ForbiddenException('That order does not belong to your account.');
    return order;
  }

  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user?: AuthUser) {
    assertIs(user, dto.buyerId);
    return this.ordersService.createOrder(dto);
  }

  @Get()
  list(@CurrentUser() user?: AuthUser, @Query('buyerId') buyerId?: string, @Query('sellerId') sellerId?: string) {
    if (buyerId) {
      assertSelf(user, buyerId);
      return this.ordersService.findForBuyer(buyerId);
    }
    if (sellerId) {
      assertSelf(user, sellerId);
      return this.ordersService.findForSeller(sellerId);
    }
    return [];
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.forParty(id, user, 'either', false);
  }

  @Patch(':id/accept')
  async accept(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    await this.forParty(id, user, 'seller');
    return this.ordersService.sellerAccept(id);
  }

  @Patch(':id/decline')
  async decline(@Param('id') id: string, @Body('actorId') actorId: string, @CurrentUser() user?: AuthUser) {
    const order = await this.forParty(id, user, 'seller');
    return this.ordersService.declineOrCancel(id, 'SELLER', user ? order.sellerId : actorId);
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Body('actorId') actorId: string, @CurrentUser() user?: AuthUser) {
    const order = await this.forParty(id, user, 'buyer');
    return this.ordersService.declineOrCancel(id, 'BUYER', user ? order.buyerId : actorId);
  }

  @Patch(':id/ship')
  async ship(@Param('id') id: string, @Body('waybillRef') waybillRef: string, @CurrentUser() user?: AuthUser) {
    await this.forParty(id, user, 'seller');
    return this.ordersService.markShipped(id, waybillRef);
  }

  @Patch(':id/in-transit')
  async inTransit(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    await this.forParty(id, user, 'seller');
    return this.ordersService.markInTransit(id);
  }

  @Patch(':id/delivered')
  async delivered(
    @Param('id') id: string,
    @Body('confirmedBy') confirmedBy: 'BUYER' | 'COURIER' | 'AUTO_TIMEOUT',
    @CurrentUser() user?: AuthUser,
  ) {
    if (confirmedBy === 'BUYER') {
      await this.forParty(id, user, 'buyer');
    } else if (user && !isAdmin(user)) {
      // Courier and timeout confirmations come from the platform, never from a buyer or seller.
      throw new ForbiddenException('Only the buyer can confirm delivery.');
    }
    return this.ordersService.confirmDelivered(id, confirmedBy);
  }

  @Patch(':id/delivery-failed')
  async deliveryFailed(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    await this.forParty(id, user, 'seller');
    return this.ordersService.markDeliveryFailed(id);
  }

  @Patch(':id/reattempt')
  async reattempt(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    await this.forParty(id, user, 'seller');
    return this.ordersService.scheduleReattempt(id);
  }

  @Patch(':id/returned')
  async returned(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    await this.forParty(id, user, 'seller');
    return this.ordersService.markReturned(id);
  }
}
