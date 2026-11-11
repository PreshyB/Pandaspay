import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  record(entry: { actorId: string; action: string; targetType: string; targetId: string; details?: Record<string, unknown> }) {
    return this.logs.save(this.logs.create(entry));
  }
}
