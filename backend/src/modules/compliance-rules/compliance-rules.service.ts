import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class ComplianceRulesService {
  constructor(
    private prisma: PrismaService,
    @Optional() private auditLog?: AuditLogService,
  ) {}

  findAll() {
    return this.prisma.complianceRule.findMany({
      include: { wasteCategory: true },
      orderBy: [{ wasteCategory: { name: 'asc' } }, { stage: 'asc' }],
    });
  }

  async update(id: string, maxDurationHours: number) {
    const updated = await this.prisma.complianceRule.update({
      where: { id },
      data: { maxDurationHours },
      include: { wasteCategory: true },
    });

    if (this.auditLog) {
      await this.auditLog.log({
        action: 'COMPLIANCE_RULE_UPDATED',
        entityType: 'ComplianceRule',
        entityId: id,
        metadata: {
          maxDurationHours,
          wasteCategory: updated.wasteCategory?.name,
          stage: updated.stage,
        },
      });
    }

    return updated;
  }
}
