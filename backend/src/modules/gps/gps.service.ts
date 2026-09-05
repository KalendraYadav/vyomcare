import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class GpsService {
  constructor(private prisma: PrismaService) {}

  async ingestPing(dto: {
    transportAssignmentId: string;
    latitude: number;
    longitude: number;
  }) {
    return this.prisma.gpsPing.create({
      data: { ...dto, recordedAt: new Date() },
    });
  }

  async getLatestPings(transportAssignmentId: string, limit = 50) {
    return this.prisma.gpsPing.findMany({
      where: { transportAssignmentId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }
}
