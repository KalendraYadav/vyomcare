import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DashboardsService {
  constructor(private prisma: PrismaService) {}

  async getHospitalDashboard(facilityId: string) {
    const [
      totalRegistered,
      pendingCollection,
      inTransit,
      delayed,
      wasteByCategory,
      recentBatches,
    ] = await Promise.all([
      this.prisma.wasteBatch.count({ where: { hospitalId: facilityId } }),
      this.prisma.wasteBatch.count({
        where: {
          hospitalId: facilityId,
          status: { in: ['REGISTERED', 'QR_ASSIGNED'] },
        },
      }),
      this.prisma.wasteBatch.count({
        where: { hospitalId: facilityId, status: 'IN_TRANSIT' },
      }),
      this.prisma.wasteBatch.count({
        where: { hospitalId: facilityId, status: 'VIOLATION' },
      }),
      this.prisma.wasteBatch.groupBy({
        by: ['categoryId'],
        where: { hospitalId: facilityId },
        _count: true,
      }),
      this.prisma.wasteBatch.findMany({
        where: { hospitalId: facilityId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { category: true },
      }),
    ]);

    const total = await this.prisma.wasteBatch.count({
      where: { hospitalId: facilityId, status: 'VERIFIED_CLOSED' },
    });
    const complianceRate =
      totalRegistered > 0 ? Math.round((total / totalRegistered) * 100) : 100;

    return {
      totalRegistered,
      pendingCollection,
      inTransit,
      delayed,
      complianceRate,
      wasteByCategory,
      recentBatches,
    };
  }

  async getFacilityDashboard(facilityId: string) {
    const [incoming, pendingInTransit, received, treatedToday] =
      await Promise.all([
        // Incoming = IN_TRANSIT with expected destination = this facility
        this.prisma.transportAssignment.count({
          where: { expectedFacilityId: facilityId, status: 'IN_PROGRESS' },
        }),
        this.prisma.wasteBatch.count({
          where: {
            status: 'IN_TRANSIT',
            transportAssignment: {
              some: { expectedFacilityId: facilityId, status: 'IN_PROGRESS' },
            },
          },
        }),
        this.prisma.wasteBatch.count({
          where: {
            status: 'RECEIVED',
            custodyEvents: {
              some: { eventType: 'ARRIVAL_VERIFIED', toUser: { facilityId } },
            },
          },
        }),
        this.prisma.wasteBatch.count({
          where: {
            status: 'VERIFIED_CLOSED',
            updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
      ]);

    const pendingBatches = await this.prisma.wasteBatch.findMany({
      where: {
        status: { in: ['IN_TRANSIT', 'RECEIVED'] },
        transportAssignment: { some: { expectedFacilityId: facilityId } },
      },
      include: {
        category: true,
        hospital: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });

    return {
      incoming,
      pendingVerification: pendingInTransit,
      received,
      treatedToday,
      pendingBatches,
    };
  }

  async getGovernmentDashboard() {
    const [totalFacilities, inTransit, openAlerts, facilities, recentAlerts] =
      await Promise.all([
        this.prisma.facility.count({ where: { status: 'APPROVED' } }),
        this.prisma.wasteBatch.count({ where: { status: 'IN_TRANSIT' } }),
        this.prisma.alert.count({ where: { status: { not: 'RESOLVED' } } }),
        this.prisma.facility.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.alert.findMany({
          where: { status: { not: 'RESOLVED' } },
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
          take: 10,
          include: { wasteBatch: { select: { wasteId: true } } },
        }),
      ]);

    const totalBatches = await this.prisma.wasteBatch.count();
    const verifiedClosed = await this.prisma.wasteBatch.count({
      where: { status: 'VERIFIED_CLOSED' },
    });
    const overallCompliance =
      totalBatches > 0
        ? Math.round((verifiedClosed / totalBatches) * 100)
        : 100;

    return {
      totalFacilities,
      inTransit,
      openAlerts,
      overallCompliance,
      facilities,
      recentAlerts,
    };
  }
}
