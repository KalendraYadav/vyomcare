import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(
    dto: CreateUserDto,
    actor: { userId: string; role: string; facilityId: string | null },
    appBaseUrl?: string,
  ) {
    if (!dto.password || dto.password.trim().length < 8) {
      throw new BadRequestException(
        'A secure password with at least 8 characters is required',
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check duplicate email
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('A user with this email address already exists');
    }

    const hash = await bcrypt.hash(dto.password, 10);

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

    // Enforce facility assignment for facility-dependent roles
    const facilityScopedRoles: UserRole[] = [
      UserRole.HOSPITAL_ADMIN,
      UserRole.HOSPITAL_STAFF,
      UserRole.TREATMENT_FACILITY_STAFF,
    ];
    if (facilityScopedRoles.includes(dto.role)) {
      if (!facilityId) {
        throw new BadRequestException(`An affiliated facility is required when provisioning ${dto.role}`);
      }
      const facility = await this.prisma.facility.findUnique({
        where: { id: facilityId },
      });
      if (!facility || facility.status === 'SUSPENDED') {
        throw new BadRequestException('The selected affiliated facility does not exist or is suspended');
      }
      if (
        (dto.role === UserRole.HOSPITAL_ADMIN || dto.role === UserRole.HOSPITAL_STAFF) &&
        facility.type !== 'HOSPITAL'
      ) {
        throw new BadRequestException('Hospital staff must be assigned to a facility of type HOSPITAL');
      }
      if (
        dto.role === UserRole.TREATMENT_FACILITY_STAFF &&
        facility.type !== 'TREATMENT_FACILITY'
      ) {
        throw new BadRequestException('CBWTF staff must be assigned to a facility of type TREATMENT_FACILITY');
      }
    }

    // Generate cryptographic single-use verification token
    const rawToken = `${uuidv4()}${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const newUser = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: normalizedEmail,
        phone: dto.phone ? dto.phone.trim() : undefined,
        role: dto.role,
        facilityId,
        passwordHash: hash,
        emailVerified: false,
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        facilityId: true,
        status: true,
        emailVerified: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    // Dispatch verification link through EmailService
    const dispatchResult = await this.emailService.sendVerificationEmail({
      email: newUser.email,
      name: newUser.name,
      rawToken,
      appBaseUrl,
    });

    return {
      ...newUser,
      verificationDispatched: dispatchResult.success,
      // Provide preview URL in development/hackathon response for demo operator ease
      verificationUrl: dispatchResult.verificationUrl,
    };
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
        emailVerified: true,
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
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
      },
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
        emailVerified: true,
        mustChangePassword: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}

