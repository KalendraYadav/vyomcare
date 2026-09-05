import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ComplianceRulesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.complianceRule.findMany({
      include: { wasteCategory: true },
      orderBy: [{ wasteCategory: { name: 'asc' } }, { stage: 'asc' }],
    });
  }

  update(id: string, maxDurationHours: number) {
    return this.prisma.complianceRule.update({
      where: { id },
      data: { maxDurationHours },
      include: { wasteCategory: true },
    });
  }
}
