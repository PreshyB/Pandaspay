import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { DisputesService, ResolveSplitInput } from './disputes.service';

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

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
