import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TransportService {
  constructor(private prisma: PrismaService) {}

  async createAssignment(dto: any) {
    return this.prisma.transportAssignment.create({
      data: dto,
      include: {
        vehicle: true,
        driverUser: { select: { id: true, name: true } },
      },
    });
  }

  async getActive() {
    return this.prisma.transportAssignment.findMany({
      where: { status: 'IN_PROGRESS' },
      include: {
        wasteBatch: {
          include: {
            category: true,
            hospital: { select: { id: true, name: true } },
          },
        },
        vehicle: true,
        driverUser: { select: { id: true, name: true } },
        expectedFacility: {
          select: { id: true, name: true, latitude: true, longitude: true },
        },
        gpsPings: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
    });
  }

  async getMyAssignment(driverId: string) {
    return this.prisma.transportAssignment.findFirst({
      where: { driverUserId: driverId, status: 'IN_PROGRESS' },
      include: {
        wasteBatch: { include: { category: true } },
        vehicle: true,
        expectedFacility: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
            geofenceRadiusM: true,
          },
        },
        gpsPings: { orderBy: { recordedAt: 'desc' }, take: 5 },
      },
    });
  }

  async listVehicles() {
    return this.prisma.vehicle.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { registrationNumber: 'asc' },
    });
  }
}
