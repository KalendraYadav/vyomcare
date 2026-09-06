import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

describe('UsersService (Production Hardened)', () => {
  let service: UsersService;
  let prisma: any;

  const hospitalAdminActor = {
    userId: 'admin-1',
    role: UserRole.HOSPITAL_ADMIN,
    facilityId: 'facility-hospital-A',
  };

  const superAdminActor = {
    userId: 'super-1',
    role: UserRole.SUPER_ADMIN,
    facilityId: null,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('P1-02: Tenant / Hospital Isolation on User Status Updates', () => {
    it('Hospital Admin → own hospital user status update → allowed', async () => {
      const sameHospitalStaff = {
        id: 'staff-1',
        name: 'Staff Same Hospital',
        role: UserRole.HOSPITAL_STAFF,
        facilityId: 'facility-hospital-A',
      };
      prisma.user.findUnique.mockResolvedValue(sameHospitalStaff);
      prisma.user.update.mockResolvedValue({
        ...sameHospitalStaff,
        status: 'DEACTIVATED',
      });

      const result = await service.updateStatus(
        'staff-1',
        'DEACTIVATED',
        hospitalAdminActor,
      );
      expect(result.status).toBe('DEACTIVATED');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'staff-1' },
        data: { status: 'DEACTIVATED' },
        select: expect.any(Object),
      });
    });

    it('Hospital Admin → another hospital user status update → denied (403 Forbidden)', async () => {
      const otherHospitalStaff = {
        id: 'staff-2',
        name: 'Staff Other Hospital',
        role: UserRole.HOSPITAL_STAFF,
        facilityId: 'facility-hospital-B',
      };
      prisma.user.findUnique.mockResolvedValue(otherHospitalStaff);

      await expect(
        service.updateStatus('staff-2', 'DEACTIVATED', hospitalAdminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Hospital Admin → super admin user status update → denied (403 Forbidden)', async () => {
      const superAdminUser = {
        id: 'super-admin-user',
        name: 'Super Admin',
        role: UserRole.SUPER_ADMIN,
        facilityId: null,
      };
      prisma.user.findUnique.mockResolvedValue(superAdminUser);

      await expect(
        service.updateStatus(
          'super-admin-user',
          'DEACTIVATED',
          hospitalAdminActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Hospital Admin → nonexistent user → throws NotFoundException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'nonexistent-id',
          'DEACTIVATED',
          hospitalAdminActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('SUPER_ADMIN → any user status update → allowed', async () => {
      const targetUser = {
        id: 'target-1',
        name: 'Any Facility User',
        role: UserRole.TREATMENT_FACILITY_STAFF,
        facilityId: 'facility-treatment-C',
      };
      prisma.user.findUnique.mockResolvedValue(targetUser);
      prisma.user.update.mockResolvedValue({
        ...targetUser,
        status: 'DEACTIVATED',
      });

      const result = await service.updateStatus(
        'target-1',
        'DEACTIVATED',
        superAdminActor,
      );
      expect(result.status).toBe('DEACTIVATED');
    });
  });

  describe('P2-02: Mandatory Password Validation (No Fallback)', () => {
    it('should throw BadRequestException if password is omitted or shorter than 8 characters', async () => {
      await expect(
        service.create(
          {
            name: 'New User',
            email: 'user@hospital.in',
            password: '',
            role: UserRole.HOSPITAL_STAFF,
          },
          hospitalAdminActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(
          {
            name: 'New User',
            email: 'user@hospital.in',
            password: 'short',
            role: UserRole.HOSPITAL_STAFF,
          },
          hospitalAdminActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create user when a secure password >= 8 characters is provided', async () => {
      prisma.user.create.mockResolvedValue({
        id: 'new-user-1',
        name: 'New Staff',
        email: 'newstaff@hospital.in',
        role: UserRole.HOSPITAL_STAFF,
        facilityId: 'facility-hospital-A',
        status: 'ACTIVE',
        createdAt: new Date(),
      });

      const result = await service.create(
        {
          name: 'New Staff',
          email: 'newstaff@hospital.in',
          password: 'SecurePassword#2026',
          role: UserRole.HOSPITAL_STAFF,
        },
        hospitalAdminActor,
      );

      expect(result.id).toBe('new-user-1');
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });
});
