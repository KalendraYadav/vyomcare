import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { EmailService } from '../../common/email/email.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { Response } from 'express';

const FAILED_LOGIN_LIMIT = 5;
const LOCKOUT_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 120; // 2 minutes between resend attempts

/**
 * Deterministically hash a token using SHA-256.
 * Storing only the SHA-256 digest in the database prevents plaintext leakage
 * while allowing an O(1) indexed lookup on unique hash columns.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redis: RedisService,
    private emailService: EmailService,
  ) {}

  async login(dto: LoginDto, res: Response) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check Redis-backed lockout before checking credentials
    await this.checkLockout(normalizedEmail);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      await this.recordFailedAttempt(normalizedEmail);
      throw new UnauthorizedException('Incorrect email or password');
    }

    if (user.status === 'DEACTIVATED') {
      throw new ForbiddenException(
        'This account has been deactivated. Contact your administrator.',
      );
    }

    // Email verification gate (P20)
    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Email address not verified. Please verify your email before logging in.',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.recordFailedAttempt(normalizedEmail);
      throw new UnauthorizedException('Incorrect email or password');
    }

    // Clear failed attempts counter upon successful authentication
    await this.clearFailedAttempts(normalizedEmail);

    // Update last login timestamp
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

    // Generate high-entropy refresh token & store deterministic SHA-256 hash (P1-01)
    const refreshToken = `${uuidv4()}-${crypto.randomBytes(16).toString('hex')}`;
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Set secure httpOnly cookie
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
        emailVerified: user.emailVerified,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async refresh(refreshToken: string, res: Response) {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    // O(1) indexed unique lookup using deterministic SHA-256 hash (P1-01)
    const tokenHash = hashToken(refreshToken);
    const matched = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!matched || matched.expiresAt < new Date()) {
      if (matched) {
        await this.prisma.refreshToken
          .delete({ where: { id: matched.id } })
          .catch(() => {});
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: Delete old token record immediately
    await this.prisma.refreshToken.delete({ where: { id: matched.id } });

    const user = matched.user;
    if (user.status === 'DEACTIVATED') {
      throw new ForbiddenException('This account has been deactivated');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email address not verified');
    }

    const payload = {
      sub: user.id,
      role: user.role,
      facilityId: user.facilityId,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    // Issue rotated new refresh token
    const newRefreshToken = `${uuidv4()}-${crypto.randomBytes(16).toString('hex')}`;
    const newHash = hashToken(newRefreshToken);
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
      const tokenHash = hashToken(refreshToken);
      await this.prisma.refreshToken
        .deleteMany({
          where: {
            tokenHash,
            userId,
          },
        })
        .catch(() => {});
    }
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return { message: 'Logged out' };
  }

  /**
   * Cryptographically verify an account email using single-use SHA-256 token hash.
   */
  async verifyEmail(dto: VerifyEmailDto) {
    const rawToken = dto.token ? dto.token.trim() : '';
    if (!rawToken || rawToken.length < 16) {
      throw new BadRequestException('Invalid verification token format');
    }

    const tokenHash = hashToken(rawToken);

    const user = await this.prisma.user.findUnique({
      where: { emailVerificationTokenHash: tokenHash },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (
      user.emailVerificationExpiresAt &&
      user.emailVerificationExpiresAt < new Date()
    ) {
      throw new BadRequestException('Verification link has expired. Please request a new verification email.');
    }

    // Single-use consumption: mark verified & nullify token hash
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });

    this.logger.log(`Account email successfully verified for: ${user.email}`);

    return {
      success: true,
      message: 'Email address successfully verified. You may now log in.',
    };
  }

  /**
   * Request a new verification token with anti-enumeration and rate-limiting.
   */
  async resendVerification(dto: ResendVerificationDto, appBaseUrl?: string) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Rate-limiting using Redis cooldown
    const rateLimitKey = `auth:resend:${normalizedEmail}`;
    const recentRequest = await this.redis.get(rateLimitKey);
    if (recentRequest) {
      const ttl = await this.redis.ttl(rateLimitKey);
      throw new ForbiddenException(
        `Please wait ${Math.max(1, ttl)} seconds before requesting another verification email.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Anti-enumeration: Return generic success even if user not found or already verified
    if (!user || user.emailVerified) {
      return {
        success: true,
        message: 'If an unverified account exists for this email, a verification link has been dispatched.',
      };
    }

    // Set rate limit cooldown
    await this.redis.set(rateLimitKey, '1', RESEND_COOLDOWN_SECONDS);

    // Generate new secure raw token
    const rawToken = `${uuidv4()}${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    // Dispatch verification email
    await this.emailService.sendVerificationEmail({
      email: user.email,
      name: user.name,
      rawToken,
      appBaseUrl,
    });

    return {
      success: true,
      message: 'If an unverified account exists for this email, a verification link has been dispatched.',
    };
  }

  // ─── Redis-Backed Login Lockout (P2-01) ────────────────────────────────────

  private getLockoutKey(email: string): string {
    return `auth:lockout:${email}`;
  }

  private async checkLockout(email: string): Promise<void> {
    const key = this.getLockoutKey(email);
    const attempts = await this.redis.get(key);
    if (attempts && parseInt(attempts, 10) >= FAILED_LOGIN_LIMIT) {
      const ttl = await this.redis.ttl(key);
      const remainingMinutes = Math.max(1, Math.ceil(ttl / 60));
      throw new ForbiddenException(
        `Too many failed attempts. Try again in ${remainingMinutes} minutes.`,
      );
    }
  }

  private async recordFailedAttempt(email: string): Promise<void> {
    const key = this.getLockoutKey(email);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, LOCKOUT_MINUTES * 60);
    }
  }

  private async clearFailedAttempts(email: string): Promise<void> {
    const key = this.getLockoutKey(email);
    await this.redis.del(key);
  }
}

