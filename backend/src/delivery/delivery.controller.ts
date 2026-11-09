import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DeliveryService, UpsertDeliveryOptionInput } from './delivery.service';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  /** Store location + all delivery options for a seller. */
  @Get('seller/:sellerId')
  forSeller(@Param('sellerId') sellerId: string) {
    return this.delivery.forSeller(sellerId);
  }

  @Patch('seller/:sellerId/location')
  setLocation(@Param('sellerId') sellerId: string, @Body() body: { storeState: string; storeCity?: string }) {
    return this.delivery.setStoreLocation(sellerId, body.storeState, body.storeCity);
  }

  /** Create or update the option for a zone x speed. */
  @Post('options')
  upsert(@Body() input: UpsertDeliveryOptionInput) {
    return this.delivery.upsert(input);
  }

  @Patch('options/:id/active')
  setActive(@Param('id') id: string, @Query('sellerId') sellerId: string, @Body('isActive') isActive: boolean) {
    return this.delivery.setActive(id, sellerId, isActive);
  }
}
