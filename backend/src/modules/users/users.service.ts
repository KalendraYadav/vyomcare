import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(
    dto: any,
    actor: { userId: string; role: string; facilityId: string | null },
  ) {
    const hash = await bcrypt.hash(dto.password || 'ChangeMe@123', 10);
    // Hospital Admin can only create Hospital Staff/Admin in their own facility
    if (actor.role === UserRole.HOSPITAL_ADMIN) {
      if (
        ![UserRole.HOSPITAL_ADMIN, UserRole.HOSPITAL_STAFF].includes(dto.role)
      ) {
        throw new ForbiddenException('You can only create hospital roles');
      }
      dto.facilityId = actor.facilityId;
    }
    return this.prisma.user.create({
      data: { ...dto, passwordHash: hash, password: undefined },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        facilityId: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async findAll(
    query: any,
    actor: { role: string; facilityId: string | null },
  ) {
    const where: any = {};
    if (actor.role === UserRole.HOSPITAL_ADMIN)
      where.facilityId = actor.facilityId;
    else if (query.facilityId) where.facilityId = query.facilityId;
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        facilityId: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'DEACTIVATED') {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        facilityId: true,
        status: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
