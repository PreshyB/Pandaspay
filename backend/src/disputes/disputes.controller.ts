import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DisputeStatus } from './entities/dispute.entity';
import { DisputesService, ResolveSplitInput } from './disputes.service';

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  list(@Query('status') status?: DisputeStatus) {
    return this.disputesService.listWithContext(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.disputesService.getWithContext(id);
  }

  @Post()
  open(@Body() body: { paymentId: string; openedById: string; reason: string; details?: string }) {
    return this.disputesService.open(body.paymentId, body.openedById, body.reason, body.details);
  }

  @Patch(':id/resolve-seller')
  resolveSeller(@Param('id') id: string, @Body() body: { resolvedById: string; notes?: string }) {
    return this.disputesService.resolveInSellersFavor(id, body.resolvedById, body.notes);
  }

  @Patch(':id/resolve-buyer')
  resolveBuyer(@Param('id') id: string, @Body() body: { resolvedById: string; notes?: string }) {
    return this.disputesService.resolveInBuyersFavor(id, body.resolvedById, body.notes);
  }

  @Patch(':id/resolve-split')
  resolveSplit(
    @Param('id') id: string,
    @Body() body: { resolvedById: string; notes?: string } & ResolveSplitInput,
  ) {
    return this.disputesService.resolveAsSplit(id, body.resolvedById, body, body.notes);
  }
}
