import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../auth/authz';
import { SellerStatus, User, UserRole } from '../users/user.entity';

interface ApplyBody {
  userId?: string; // only honoured while AUTH_ENFORCED is off and no token is sent
  businessName: string;
  socialLink?: string;
  note?: string;
  storeState: string;
  storeCity?: string;
}

@Controller('sellers')
export class SellersController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  /** The signed-in user asks to sell. Nothing seller-related unlocks until an admin approves. */
  @Post('apply')
  async apply(@Body() body: ApplyBody, @CurrentUser() actor?: AuthUser) {
    const id = actor?.id ?? body.userId;
    const user = id ? await this.users.findOneBy({ id }) : null;
    if (!user) throw new NotFoundException('Account not found.');
    if (user.sellerStatus === SellerStatus.APPROVED || user.roles.includes(UserRole.SELLER)) {
      throw new BadRequestException('This account is already an approved seller.');
    }
    if (user.sellerStatus === SellerStatus.PENDING) throw new BadRequestException('Your application is already being reviewed.');
    const businessName = body.businessName?.trim();
    if (!businessName || businessName.length < 2) throw new BadRequestException('Enter your business or store name.');
    if (!body.storeState?.trim()) throw new BadRequestException('Choose the state your store is in.');

    user.sellerStatus = SellerStatus.PENDING;
    user.sellerApplication = {
      businessName,
      socialLink: body.socialLink?.trim() || undefined,
      note: body.note?.trim() || undefined,
      submittedAt: new Date().toISOString(),
    };
    user.sellerReviewNote = null;
    user.sellerReviewedAt = null;
    user.storeState = body.storeState.trim();
    user.storeCity = body.storeCity?.trim() || undefined;
    return this.users.save(user);
  }

  @Roles(UserRole.ADMIN)
  @Get('applications')
  list(@Query('status') status: SellerStatus = SellerStatus.PENDING) {
    return this.users.find({ where: { sellerStatus: status }, order: { updatedAt: 'ASC' } });
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/approve')
  async approve(@Param('id') id: string, @CurrentUser() actor?: AuthUser) {
    const user = await this.pending(id);
    user.sellerStatus = SellerStatus.APPROVED;
    user.roles = Array.from(new Set([...user.roles, UserRole.SELLER]));
    user.sellerReviewNote = null;
    user.sellerReviewedAt = new Date();
    const saved = await this.users.save(user);
    await this.audit.record({ actorId: actor?.id ?? 'unauthenticated', action: 'SELLER_APPROVED', targetType: 'user', targetId: id });
    return saved;
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser() actor?: AuthUser) {
    if (!reason || reason.trim().length < 5) throw new BadRequestException('Give a short reason the seller can read.');
    const user = await this.pending(id);
    user.sellerStatus = SellerStatus.REJECTED;
    user.sellerReviewNote = reason.trim();
    user.sellerReviewedAt = new Date();
    const saved = await this.users.save(user);
    await this.audit.record({
      actorId: actor?.id ?? 'unauthenticated',
      action: 'SELLER_REJECTED',
      targetType: 'user',
      targetId: id,
      details: { reason: reason.trim() },
    });
    return saved;
  }

  private async pending(id: string) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('Account not found.');
    if (user.sellerStatus !== SellerStatus.PENDING) throw new BadRequestException('This application is not waiting for review.');
    return user;
  }
}
