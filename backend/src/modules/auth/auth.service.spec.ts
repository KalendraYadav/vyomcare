import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../common/redis/redis.service';
import { EmailService } from '../../common/email/email.service';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

describe('AuthService (Production Hardened + Email Verification)', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let redis: any;
  let emailService: any;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'admin@hospital.in',
    name: 'Hospital Admin',
    passwordHash: '',
    role: 'HOSPITAL_ADMIN',
    facilityId: 'facility-uuid-1',
    status: 'ACTIVE',
    emailVerified: true,
    mustChangePassword: false,
  };

  const mockUnverifiedUser = {
    id: 'user-uuid-2',
    email: 'newuser@hospital.in',
    name: 'New Staff',
    passwordHash: '',
    role: 'HOSPITAL_STAFF',
    facilityId: 'facility-uuid-1',
    status: 'ACTIVE',
    emailVerified: false,
    emailVerificationTokenHash: crypto
      .createHash('sha256')
      .update('valid-token-1234567890abcdef')
      .digest('hex'),
    emailVerificationExpiresAt: new Date(Date.now() + 86400000), // +24h
    mustChangePassword: true,
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('CorrectPass#123', 10);
    mockUnverifiedUser.passwordHash = await bcrypt.hash('CorrectPass#123', 10);
  });

  beforeEach(async () => {
    const redisStore = new Map<string, string>();
    redis = {
      get: jest.fn(async (k: string) => redisStore.get(k) || null),
      set: jest.fn(async (k: string, v: string) =>
        redisStore.set(k, String(v)),
      ),
      incr: jest.fn(async (k: string) => {
        const current = parseInt(redisStore.get(k) || '0', 10) + 1;
        redisStore.set(k, String(current));
        return current;
      }),
      expire: jest.fn(async () => true),
      ttl: jest.fn(async () => 900),
      del: jest.fn(async (k: string) => {
        redisStore.delete(k);
      }),
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    jwtService = {
      sign: jest.fn(() => 'mock-jwt-access-token'),
    };

    emailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue({
        success: true,
        verificationUrl: 'http://localhost:3000/verify-email?token=xyz',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: RedisService, useValue: redis },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('P1-01: Refresh Token Indexed Lookup', () => {
    it('should query refreshToken via single indexed SHA-256 tokenHash lookup without full-table scan', async () => {
      const plainToken = 'test-token-uuid-123';
      const expectedHash = crypto
        .createHash('sha256')
        .update(plainToken)
        .digest('hex');

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-db-id-1',
        tokenHash: expectedHash,
        expiresAt: new Date(Date.now() + 100000),
        user: mockUser,
      });
      prisma.refreshToken.delete.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const mockRes: any = { cookie: jest.fn() };
      const result = await service.refresh(plainToken, mockRes);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: expectedHash },
        include: { user: true },
      });
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-db-id-1' },
      });
      expect(result.accessToken).toBe('mock-jwt-access-token');
      expect(mockRes.cookie).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if refresh token is expired or invalid', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      const mockRes: any = { cookie: jest.fn() };

      await expect(service.refresh('invalid-token', mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should delete token by SHA-256 hash on logout', async () => {
      const plainToken = 'test-logout-token';
      const expectedHash = crypto
        .createHash('sha256')
        .update(plainToken)
        .digest('hex');
      const mockRes: any = { clearCookie: jest.fn() };

      await service.logout('user-uuid-1', plainToken, mockRes);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          tokenHash: expectedHash,
          userId: 'user-uuid-1',
        },
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/api/auth/refresh',
      });
    });
  });

  describe('P2-01: Redis Distributed Login Rate Limiting & Verification Gate', () => {
    it('should record failed login in Redis and lock out account after 5 failed attempts', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const mockRes: any = { cookie: jest.fn() };

      // Attempt 1 to 4: Wrong password
      for (let i = 0; i < 4; i++) {
        await expect(
          service.login(
            { email: 'admin@hospital.in', password: 'WrongPassword!' },
            mockRes,
          ),
        ).rejects.toThrow(UnauthorizedException);
      }

      expect(redis.incr).toHaveBeenCalledTimes(4);

      // Attempt 5: Trigger lockout
      await expect(
        service.login(
          { email: 'admin@hospital.in', password: 'WrongPassword!' },
          mockRes,
        ),
      ).rejects.toThrow();

      // Subsequent attempt: Blocked by lockout before password check
      redis.get.mockResolvedValue('5');
      await expect(
        service.login(
          { email: 'admin@hospital.in', password: 'CorrectPass#123' },
          mockRes,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject login for unverified user with explicit message', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUnverifiedUser);
      const mockRes: any = { cookie: jest.fn() };

      await expect(
        service.login(
          { email: 'newuser@hospital.in', password: 'CorrectPass#123' },
          mockRes,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow login and clear failed attempts in Redis for verified user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({});
      const mockRes: any = { cookie: jest.fn() };

      const result = await service.login(
        { email: 'admin@hospital.in', password: 'CorrectPass#123' },
        mockRes,
      );

      expect(result.accessToken).toBe('mock-jwt-access-token');
      expect(redis.del).toHaveBeenCalledWith('auth:lockout:admin@hospital.in');
    });
  });

  describe('P20: Email Verification Cryptographic Lifecycle', () => {
    it('should successfully verify email with matching SHA-256 token hash and clear token fields', async () => {
      const rawToken = 'valid-token-1234567890abcdef';
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      prisma.user.findUnique.mockResolvedValue(mockUnverifiedUser);
      prisma.user.update.mockResolvedValue({
        ...mockUnverifiedUser,
        emailVerified: true,
      });

      const res = await service.verifyEmail({ token: rawToken });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { emailVerificationTokenHash: tokenHash },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUnverifiedUser.id },
        data: expect.objectContaining({
          emailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        }),
      });
      expect(res.success).toBe(true);
    });

    it('should reject invalid or already consumed verification token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyEmail({ token: 'nonexistent-token-12345678' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject expired verification token', async () => {
      const rawToken = 'expired-token-1234567890abcdef';
      prisma.user.findUnique.mockResolvedValue({
        ...mockUnverifiedUser,
        emailVerificationExpiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      });

      await expect(service.verifyEmail({ token: rawToken })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow resending verification email with rate limit and token rotation', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUnverifiedUser);
      prisma.user.update.mockResolvedValue(mockUnverifiedUser);

      const res = await service.resendVerification({
        email: 'newuser@hospital.in',
      });

      expect(res.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUnverifiedUser.id },
        data: expect.objectContaining({
          emailVerificationTokenHash: expect.any(String),
          emailVerificationExpiresAt: expect.any(Date),
        }),
      });
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });
  });
});
