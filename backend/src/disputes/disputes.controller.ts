import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../auth/authz';
import { UserRole } from '../users/user.entity';
import { DisputeStatus } from './entities/dispute.entity';
import { DisputesService, ResolveSplitInput } from './disputes.service';

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

  @Roles(UserRole.ADMIN)
  @Get(':id')
  get(@Param('id') id: string) {
    return this.disputesService.getWithContext(id);
  }

  @Post()
  async open(
    @Body() body: { paymentId: string; openedById: string; reason: string; details?: string },
    @CurrentUser() user?: AuthUser,
  ) {
    const openedById = user?.id ?? body.openedById;
    if (user) await this.disputesService.assertBuyerOfPayment(body.paymentId, user.id);
    return this.disputesService.open(body.paymentId, openedById, body.reason, body.details);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/resolve-seller')
  async resolveSeller(@Param('id') id: string, @Body() body: { resolvedById: string; notes?: string }, @CurrentUser() user?: AuthUser) {
    const by = user?.id ?? body.resolvedById;
    const result = await this.disputesService.resolveInSellersFavor(id, by, body.notes);
    await this.audit.record({ actorId: by, action: 'DISPUTE_RESOLVED_SELLER', targetType: 'dispute', targetId: id, details: { notes: body.notes } });
    return result;
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/resolve-buyer')
  async resolveBuyer(@Param('id') id: string, @Body() body: { resolvedById: string; notes?: string }, @CurrentUser() user?: AuthUser) {
    const by = user?.id ?? body.resolvedById;
    const result = await this.disputesService.resolveInBuyersFavor(id, by, body.notes);
    await this.audit.record({ actorId: by, action: 'DISPUTE_RESOLVED_BUYER', targetType: 'dispute', targetId: id, details: { notes: body.notes } });
    return result;
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/resolve-split')
  async resolveSplit(
    @Param('id') id: string,
    @Body() body: { resolvedById: string; notes?: string } & ResolveSplitInput,
    @CurrentUser() user?: AuthUser,
  ) {
    const by = user?.id ?? body.resolvedById;
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
