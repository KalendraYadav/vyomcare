import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AlertType,
  AlertSeverity,
  AlertStatus,
  UserRole,
} from '@prisma/client';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    wasteBatchId?: string;
    type: AlertType;
    severity: AlertSeverity;
  }) {
    return this.prisma.alert.create({
      data: { ...data, status: AlertStatus.OPEN },
    });
  }

  async findAll(query: any, user: { role: string; facilityId: string | null }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.severity) where.severity = query.severity;

    // Facility-scoped roles only see alerts for their own batches.
    // Use Set.has() to avoid TypeScript's strict literal-tuple narrowing on Array.includes().
    const crossFacilityRoles = new Set<string>([
      UserRole.SUPER_ADMIN,
      UserRole.GOVERNMENT_AUTHORITY,
    ]);
    if (!crossFacilityRoles.has(user.role)) {
      where.wasteBatch = { hospitalId: user.facilityId };
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 25;

    const [items, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        include: {
          wasteBatch: { select: { wasteId: true, hospitalId: true } },
        },
      }),
      this.prisma.alert.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    return this.prisma.alert.findUniqueOrThrow({
      where: { id },
      include: {
        wasteBatch: {
          include: {
            category: true,
            hospital: true,
            custodyEvents: {
              orderBy: { occurredAt: 'asc' },
              include: {
                fromUser: { select: { id: true, name: true, role: true } },
                toUser: { select: { id: true, name: true, role: true } },
              },
            },
          },
        },
      },
    });
  }

  async update(
    id: string,
    dto: { status?: AlertStatus; notes?: string },
    userId: string,
  ) {
    const data: any = {};
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === AlertStatus.RESOLVED) {
        data.resolvedAt = new Date();
        data.resolvedByUserId = userId;
      }
    }
    if (dto.notes !== undefined) data.notes = dto.notes;
    return this.prisma.alert.update({ where: { id }, data });
  }
}
