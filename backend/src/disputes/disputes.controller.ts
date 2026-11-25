import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, isAdmin, Roles } from '../auth/authz';
import { UserRole } from '../users/user.entity';
import { DisputeStatus } from './entities/dispute.entity';
import { OpenDisputeDto, RespondDisputeDto, ResolveDisputeDto, ResolveSplitDto } from './dto/dispute.dto';
import { DisputesService } from './disputes.service';

@Controller('disputes')
export class DisputesController {
  constructor(
    private readonly disputesService: DisputesService,
    private readonly audit: AuditService,
  ) {}

  @Roles(UserRole.ADMIN)
  @Get()
  list(@Query('status') status?: DisputeStatus) {
    return this.disputesService.listWithContext(status);
  }

  /** Buyer, seller or admin: the dispute on one payment (declared before :id so it is not read as an id). */
  @Get('by-payment/:paymentId')
  byPayment(@Param('paymentId') paymentId: string, @CurrentUser() user?: AuthUser) {
    return this.disputesService.findForParty(paymentId, user?.id, isAdmin(user));
  }

  @Post(':id/respond')
  respond(@Param('id') id: string, @Body() body: RespondDisputeDto, @CurrentUser() user?: AuthUser) {
    return this.disputesService.respond(id, user?.id ?? body.userId, body.response);
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  get(@Param('id') id: string) {
    return this.disputesService.getWithContext(id);
  }

  @Post()
  async open(
    @Body() body: OpenDisputeDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const openedById = user?.id ?? body.openedById ?? 'unknown';
    if (user) await this.disputesService.assertBuyerOfPayment(body.paymentId, user.id);
    return this.disputesService.open(body.paymentId, openedById, body.reason, body.details);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/resolve-seller')
  async resolveSeller(@Param('id') id: string, @Body() body: ResolveDisputeDto, @CurrentUser() user?: AuthUser) {
    const by = user?.id ?? body.resolvedById ?? 'unknown';
    const result = await this.disputesService.resolveInSellersFavor(id, by, body.notes);
    await this.audit.record({ actorId: by, action: 'DISPUTE_RESOLVED_SELLER', targetType: 'dispute', targetId: id, details: { notes: body.notes } });
    return result;
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/resolve-buyer')
  async resolveBuyer(@Param('id') id: string, @Body() body: ResolveDisputeDto, @CurrentUser() user?: AuthUser) {
    const by = user?.id ?? body.resolvedById ?? 'unknown';
    const result = await this.disputesService.resolveInBuyersFavor(id, by, body.notes);
    await this.audit.record({ actorId: by, action: 'DISPUTE_RESOLVED_BUYER', targetType: 'dispute', targetId: id, details: { notes: body.notes } });
    return result;
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/resolve-split')
  async resolveSplit(
    @Param('id') id: string,
    @Body() body: ResolveSplitDto,
    @CurrentUser() user?: AuthUser,
  ) {
    const by = user?.id ?? body.resolvedById ?? 'unknown';
    const result = await this.disputesService.resolveAsSplit(id, by, body, body.notes);
    await this.audit.record({
      actorId: by,
      action: 'DISPUTE_RESOLVED_SPLIT',
      targetType: 'dispute',
      targetId: id,
      details: { notes: body.notes, releaseMinor: body.releaseMinor, refundMinor: body.refundMinor },
    });
    return result;
  }
}
