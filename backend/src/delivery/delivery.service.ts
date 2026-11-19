import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { DeliveryOption, DeliverySpeed, DeliveryZone } from './delivery-option.entity';

export interface UpsertDeliveryOptionInput {
  sellerId: string;
  zone: DeliveryZone;
  speed: DeliverySpeed;
  feeMinor: string | number;
  minHours: number;
  maxHours: number;
}

export const MIN_PROMISE_HOURS = 1;
export const MAX_PROMISE_HOURS = 120; // 5 days

/** Case/space-insensitive state comparison ("Lagos" vs " lagos "). */
export const sameState = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(DeliveryOption) private readonly options: Repository<DeliveryOption>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async setStoreLocation(sellerId: string, storeState: string, storeCity?: string): Promise<User> {
    const state = storeState?.trim();
    if (!state) throw new BadRequestException('Store state is required');
    const seller = await this.users.findOneBy({ id: sellerId });
    if (!seller) throw new NotFoundException('Seller not found');
    seller.storeState = state;
    seller.storeCity = storeCity?.trim() || undefined;
    return this.users.save(seller);
  }

  /** What a buyer (or the seller's own setup screen) needs: store location + every option, paused ones included. */
  async forSeller(sellerId: string) {
    const seller = await this.users.findOneBy({ id: sellerId });
    if (!seller) throw new NotFoundException('Seller not found');
    const options = await this.options.find({ where: { sellerId }, order: { zone: 'ASC', speed: 'ASC' } });
    return { storeState: seller.storeState ?? null, storeCity: seller.storeCity ?? null, options };
  }

  async upsert(input: UpsertDeliveryOptionInput): Promise<DeliveryOption> {
    const seller = await this.users.findOneBy({ id: input.sellerId });
    if (!seller) throw new NotFoundException('Seller not found');
    if (!seller.storeState) throw new BadRequestException('Set your store location before adding delivery options');
    if (!Object.values(DeliveryZone).includes(input.zone)) throw new BadRequestException('Unknown delivery zone');
    if (!Object.values(DeliverySpeed).includes(input.speed)) throw new BadRequestException('Unknown delivery speed');

    const fee = Number(input.feeMinor);
    if (!Number.isInteger(fee) || fee < 0) throw new BadRequestException('Fee must be zero or a positive amount');
    const { minHours, maxHours } = input;
    if (
      !Number.isInteger(minHours) ||
      !Number.isInteger(maxHours) ||
      minHours < MIN_PROMISE_HOURS ||
      maxHours > MAX_PROMISE_HOURS ||
      minHours > maxHours
    ) {
      throw new BadRequestException('Delivery time must be between 1 hour and 5 days');
    }

    const existing = await this.options.findOneBy({ sellerId: input.sellerId, zone: input.zone, speed: input.speed });
    const option = existing ?? this.options.create({ sellerId: input.sellerId, zone: input.zone, speed: input.speed });
    option.feeMinor = String(fee);
    option.minHours = minHours;
    option.maxHours = maxHours;
    option.isActive = true;
    return this.options.save(option);
  }

  async setActive(optionId: string, sellerId: string, isActive: boolean): Promise<DeliveryOption> {
    const option = await this.options.findOneBy({ id: optionId });
    if (!option || option.sellerId !== sellerId) throw new NotFoundException('Delivery option not found');
    option.isActive = !!isActive;
    return this.options.save(option);
  }
}
