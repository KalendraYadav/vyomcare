import { Test, TestingModule } from '@nestjs/testing';
import { WasteBatchesService } from './waste-batches.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QrService } from '../qr/qr.service';
import { UserRole, WasteBatchStatus } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('WasteBatchesService (Production Hardened)', () => {
  let service: WasteBatchesService;
  let prisma: any;
  let qrService: any;

  const hospitalStaffActor = {
    userId: 'staff-user-1',
    role: UserRole.HOSPITAL_STAFF,
    facilityId: 'facility-hospital-A',
  };

  const superAdminActor = {
    userId: 'super-admin-1',
    role: UserRole.SUPER_ADMIN,
    facilityId: null,
  };

  const governmentActor = {
    userId: 'gov-user-1',
    role: UserRole.GOVERNMENT_AUTHORITY,
    facilityId: null,
  };

  const mockBatchHospitalA = {
    id: 'batch-uuid-1',
    wasteId: 'BMW-2026-000001',
    categoryId: 'cat-yellow',
    hospitalId: 'facility-hospital-A',
    department: 'Surgery',
    quantity: 12.5,
    unit: 'KG',
    status: WasteBatchStatus.REGISTERED,
    createdAt: new Date(),
  };

  const mockBatchHospitalB = {
    id: 'batch-uuid-2',
    wasteId: 'BMW-2026-000002',
    categoryId: 'cat-red',
    hospitalId: 'facility-hospital-B',
    department: 'ICU',
    quantity: 8.0,
    unit: 'KG',
    status: WasteBatchStatus.REGISTERED,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      wasteBatch: {
        findUnique: jest.fn(),
      },
      custodyEvent: {
        findMany: jest.fn(),
      },
    };

    qrService = {
      generateDataUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WasteBatchesService,
        { provide: PrismaService, useValue: prisma },
        { provide: QrService, useValue: qrService },
      ],
    }).compile();

    service = module.get<WasteBatchesService>(WasteBatchesService);
  });

  describe('P2-03: Hospital Batch Detail Scoping (findById & getHistory)', () => {
    it('Hospital Staff → own hospital batch → allowed', async () => {
      prisma.wasteBatch.findUnique.mockResolvedValue(mockBatchHospitalA);

      const result = await service.findById('batch-uuid-1', hospitalStaffActor);
      expect(result.id).toBe('batch-uuid-1');
      expect(result.hospitalId).toBe('facility-hospital-A');
    });

    it('Hospital Staff → another hospital batch → denied (403 Forbidden)', async () => {
      prisma.wasteBatch.findUnique.mockResolvedValue(mockBatchHospitalB);

      await expect(
        service.findById('batch-uuid-2', hospitalStaffActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Hospital Staff → nonexistent batch → throws NotFoundException', async () => {
      prisma.wasteBatch.findUnique.mockResolvedValue(null);

      await expect(
        service.findById('nonexistent-batch-id', hospitalStaffActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('SUPER_ADMIN → any hospital batch → allowed', async () => {
      prisma.wasteBatch.findUnique.mockResolvedValue(mockBatchHospitalB);

      const result = await service.findById('batch-uuid-2', superAdminActor);
      expect(result.id).toBe('batch-uuid-2');
    });

    it('GOVERNMENT_AUTHORITY → any hospital batch → allowed', async () => {
      prisma.wasteBatch.findUnique.mockResolvedValue(mockBatchHospitalA);

      const result = await service.findById('batch-uuid-1', governmentActor);
      expect(result.id).toBe('batch-uuid-1');
    });

    it('getHistory enforces hospital scoping via findById check', async () => {
      prisma.wasteBatch.findUnique.mockResolvedValue(mockBatchHospitalB);

      await expect(
        service.getHistory('batch-uuid-2', hospitalStaffActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
