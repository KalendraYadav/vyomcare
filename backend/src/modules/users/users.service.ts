import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(
    dto: CreateUserDto,
    actor: { userId: string; role: string; facilityId: string | null },
  ) {
    if (!dto.password || dto.password.trim().length < 8) {
      throw new BadRequestException(
        'A secure password with at least 8 characters is required',
      );
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Hospital Admin can only create Hospital Staff/Admin in their own facility
    let facilityId = dto.facilityId;
    if (actor.role === UserRole.HOSPITAL_ADMIN) {
      if (
        !(
          [UserRole.HOSPITAL_ADMIN, UserRole.HOSPITAL_STAFF] as UserRole[]
        ).includes(dto.role)
      ) {
        throw new ForbiddenException('You can only create hospital roles');
      }
      facilityId = actor.facilityId ?? undefined;
    }

    return this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: normalizedEmail,
        phone: dto.phone,
        role: dto.role,
        facilityId,
        passwordHash: hash,
      },
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

  async updateStatus(
    id: string,
    status: 'ACTIVE' | 'DEACTIVATED',
    actor: { userId: string; role: string; facilityId: string | null },
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!targetUser) throw new NotFoundException('User not found');

    // Enforce tenant boundary for HOSPITAL_ADMIN (P1-02)
    if (actor.role === UserRole.HOSPITAL_ADMIN) {
      if (!actor.facilityId || targetUser.facilityId !== actor.facilityId) {
        throw new ForbiddenException(
          'You are not authorized to modify users outside your facility',
        );
      }
      if (
        !(
          [UserRole.HOSPITAL_ADMIN, UserRole.HOSPITAL_STAFF] as UserRole[]
        ).includes(targetUser.role)
      ) {
        throw new ForbiddenException(
          'You can only modify status for hospital users in your facility',
        );
      }
    }

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
