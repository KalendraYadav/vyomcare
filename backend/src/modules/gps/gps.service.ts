import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { IngestGpsPingDto } from './dto/ingest-gps-ping.dto';

@Injectable()
export class GpsService {
  constructor(private prisma: PrismaService) {}

  async ingestPing(
    dto: IngestGpsPingDto,
    user: { userId: string; role: string },
  ) {
    const assignment = await this.prisma.transportAssignment.findUnique({
      where: { id: dto.transportAssignmentId },
      include: { wasteBatch: true },
    });

    if (!assignment) {
      throw new NotFoundException('Transport assignment not found');
    }

    // Enforce driver ownership: only the assigned driver or SUPER_ADMIN can submit pings
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      assignment.driverUserId !== user.userId
    ) {
      throw new ForbiddenException(
        'You are not authorized to submit GPS telemetry for this transport assignment',
      );
    }

    // Validate assignment status: only active IN_PROGRESS runs accept GPS telemetry
    if (assignment.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cannot submit GPS telemetry for transport assignment in status '${assignment.status}'`,
      );
    }

    // Record the GPS ping and atomically update current location on the waste batch
    return this.prisma.$transaction(async (tx) => {
      const ping = await tx.gpsPing.create({
        data: {
          transportAssignmentId: dto.transportAssignmentId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          recordedAt: new Date(),
        },
      });

      if (assignment.wasteBatchId) {
        await tx.wasteBatch.update({
          where: { id: assignment.wasteBatchId },
          data: {
            currentLatitude: dto.latitude,
            currentLongitude: dto.longitude,
          },
        });
      }

      return ping;
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
