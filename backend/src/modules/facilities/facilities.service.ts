import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class FacilitiesService {
  constructor(
    private prisma: PrismaService,
    @Optional() private auditLog?: AuditLogService,
  ) {}

  async register(dto: any) {
    return this.prisma.facility.create({ data: { ...dto, status: 'PENDING' } });
  }

  async approve(id: string, action: 'APPROVED' | 'SUSPENDED') {
    const updated = await this.prisma.facility.update({
      where: { id },
      data: { status: action },
    });

    if (this.auditLog) {
      await this.auditLog.log({
        action: 'FACILITY_STATUS_UPDATED',
        entityType: 'Facility',
        entityId: id,
        metadata: { newStatus: action },
      });
    }

    return updated;
  }

  async findAll(query: any) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    return this.prisma.facility.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.facility.findUniqueOrThrow({ where: { id } });
  }

  async update(id: string, dto: any) {
    const updated = await this.prisma.facility.update({ where: { id }, data: dto });

    if (this.auditLog) {
      await this.auditLog.log({
        action: 'FACILITY_UPDATED',
        entityType: 'Facility',
        entityId: id,
        metadata: dto,
      });
    }

    return updated;
  }
}
