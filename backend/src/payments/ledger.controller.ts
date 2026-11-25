import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/authz';
import { UserRole } from '../users/user.entity';
import { LedgerService } from './ledger.service';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Roles(UserRole.ADMIN)
  @Get('reconciliation')
  reconciliation() {
    return this.ledger.reconcile();
  }
}
