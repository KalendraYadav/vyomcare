import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: any;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({ data });
  }

  async findAll(query: any) {
    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.actorUserId) where.actorUserId = query.actorUserId;
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }
}
