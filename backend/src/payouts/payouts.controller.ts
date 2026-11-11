import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { AuthUser, assertIs, assertSeller, assertSelf, CurrentUser, Roles } from '../auth/authz';
import { UserRole } from '../users/user.entity';
import { PayoutRequestStatus } from './payout.entities';
import { PayoutsService } from './payouts.service';

@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('seller/:sellerId/summary')
  summary(@Param('sellerId') sellerId: string, @CurrentUser() user?: AuthUser) {
    assertSelf(user, sellerId);
    return this.payouts.summary(sellerId);
  }

  @Get('seller/:sellerId/account')
  account(@Param('sellerId') sellerId: string, @CurrentUser() user?: AuthUser) {
    assertSelf(user, sellerId);
    return this.payouts.getAccount(sellerId);
  }

  @Put('seller/:sellerId/account')
  saveAccount(
    @Param('sellerId') sellerId: string,
    @Body() body: { bankName: string; accountName: string; accountNumber: string },
    @CurrentUser() user?: AuthUser,
  ) {
    assertSeller(user);
    assertIs(user, sellerId);
    return this.payouts.saveAccount(sellerId, body);
  }

  @Get('seller/:sellerId/requests')
  mine(@Param('sellerId') sellerId: string, @CurrentUser() user?: AuthUser) {
    assertSelf(user, sellerId);
    return this.payouts.requestsFor(sellerId);
  }

  @Post('seller/:sellerId/request')
  request(@Param('sellerId') sellerId: string, @CurrentUser() user?: AuthUser) {
    assertSeller(user);
    assertIs(user, sellerId);
    return this.payouts.request(sellerId);
  }

  @Roles(UserRole.ADMIN)
  @Get('requests')
  all(@Query('status') status: PayoutRequestStatus = PayoutRequestStatus.REQUESTED) {
    return this.payouts.listByStatus(status);
  }

  @Roles(UserRole.ADMIN)
  @Patch('requests/:id/approve')
  approve(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.payouts.approve(id, user?.id ?? 'unauthenticated');
  }

  @Roles(UserRole.ADMIN)
  @Patch('requests/:id/reject')
  reject(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser() user?: AuthUser) {
    if (!reason || reason.trim().length < 5) throw new BadRequestException('Give a short reason the seller can read.');
    return this.payouts.reject(id, user?.id ?? 'unauthenticated', reason.trim());
  }
}
