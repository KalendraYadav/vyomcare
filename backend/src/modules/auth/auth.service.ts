import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';

const FAILED_LOGIN_LIMIT = 5;
const LOCKOUT_MINUTES = 15;

// Simple in-memory rate limiter (production: use Redis)
const failedAttempts = new Map<string, { count: number; since: Date }>();

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      this.recordFailedAttempt(dto.email);
      throw new UnauthorizedException('Incorrect email or password');
    }

    // Check lockout
    this.checkLockout(dto.email);

    if (user.status === 'DEACTIVATED') {
      throw new ForbiddenException(
        'This account has been deactivated. Contact your administrator.',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.recordFailedAttempt(dto.email);
      throw new UnauthorizedException('Incorrect email or password');
    }

    // Clear failed attempts on success
    failedAttempts.delete(dto.email);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      sub: user.id,
      role: user.role,
      facilityId: user.facilityId,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: refreshTokenHash, expiresAt },
    });

    // Set httpOnly refresh cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
      path: '/api/auth/refresh',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        facilityId: user.facilityId,
      },
    };
  }

  async refresh(refreshToken: string, res: Response) {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    const tokens = await this.prisma.refreshToken.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    let matched: (typeof tokens)[number] | null = null;
    for (const t of tokens) {
      const valid = await bcrypt.compare(refreshToken, t.tokenHash);
      if (valid) {
        matched = t;
        break;
      }
    }

    if (!matched)
      throw new UnauthorizedException('Invalid or expired refresh token');

    // Rotate: delete old, issue new
    await this.prisma.refreshToken.delete({ where: { id: matched.id } });

    const user = matched.user;
    const payload = {
      sub: user.id,
      role: user.role,
      facilityId: user.facilityId,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const newRefreshToken = uuidv4();
    const newHash = await bcrypt.hash(newRefreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: newHash, expiresAt },
    });

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
      path: '/api/auth/refresh',
    });

    return { accessToken };
  }

  async logout(
    userId: string,
    refreshToken: string | undefined,
    res: Response,
  ) {
    if (refreshToken) {
      const tokens = await this.prisma.refreshToken.findMany({
        where: { userId, expiresAt: { gt: new Date() } },
      });
      for (const t of tokens) {
        const valid = await bcrypt.compare(refreshToken, t.tokenHash);
        if (valid) {
          await this.prisma.refreshToken.delete({ where: { id: t.id } });
          break;
        }
      }
    }
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return { message: 'Logged out' };
  }

  private recordFailedAttempt(email: string) {
    const now = new Date();
    const existing = failedAttempts.get(email);
    if (
      !existing ||
      now.getTime() - existing.since.getTime() > LOCKOUT_MINUTES * 60 * 1000
    ) {
      failedAttempts.set(email, { count: 1, since: now });
    } else {
      existing.count++;
    }
  }

  private checkLockout(email: string) {
    const existing = failedAttempts.get(email);
    if (!existing) return;
    const elapsed = (Date.now() - existing.since.getTime()) / 1000 / 60;
    if (elapsed > LOCKOUT_MINUTES) {
      failedAttempts.delete(email);
      return;
    }
    if (existing.count >= FAILED_LOGIN_LIMIT) {
      const remaining = Math.ceil(LOCKOUT_MINUTES - elapsed);
      throw new ForbiddenException(
        `Too many failed attempts. Try again in ${remaining} minutes.`,
      );
    }
  }
}
