import { Test, TestingModule } from '@nestjs/testing';
import { GpsService } from './gps.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('GpsService (Driver Ownership & Security)', () => {
  let service: GpsService;
  let prisma: any;

  const driverA = { userId: 'driver-user-A', role: UserRole.TRANSPORT_PERSONNEL };
  const driverB = { userId: 'driver-user-B', role: UserRole.TRANSPORT_PERSONNEL };
  const superAdmin = { userId: 'super-admin-user', role: UserRole.SUPER_ADMIN };

  const validAssignment = {
    id: 'assignment-1',
    wasteBatchId: 'batch-1',
    vehicleId: 'vehicle-1',
    driverUserId: 'driver-user-A',
    status: 'IN_PROGRESS',
  };

  beforeEach(async () => {
    prisma = {
      transportAssignment: {
        findUnique: jest.fn(),
      },
      gpsPing: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      wasteBatch: {
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GpsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GpsService>(GpsService);
  });

  it('Driver A submits GPS ping for own active assignment → ALLOWED', async () => {
    prisma.transportAssignment.findUnique.mockResolvedValue(validAssignment);
    prisma.gpsPing.create.mockResolvedValue({
      id: 'ping-1',
      transportAssignmentId: 'assignment-1',
      latitude: 19.076,
      longitude: 72.8777,
      recordedAt: new Date(),
    });

    const result = await service.ingestPing(
      { transportAssignmentId: 'assignment-1', latitude: 19.076, longitude: 72.8777 },
      driverA,
    );

    expect(result.id).toBe('ping-1');
    expect(prisma.gpsPing.create).toHaveBeenCalled();
  });

  it('Driver B attempts GPS ping on Driver A assignment → DENIED (403 Forbidden)', async () => {
    prisma.transportAssignment.findUnique.mockResolvedValue(validAssignment);

    await expect(
      service.ingestPing(
        { transportAssignmentId: 'assignment-1', latitude: 19.076, longitude: 72.8777 },
        driverB,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('SUPER_ADMIN submits GPS ping on any assignment → ALLOWED', async () => {
    prisma.transportAssignment.findUnique.mockResolvedValue(validAssignment);
    prisma.gpsPing.create.mockResolvedValue({
      id: 'ping-super',
      transportAssignmentId: 'assignment-1',
      latitude: 19.076,
      longitude: 72.8777,
      recordedAt: new Date(),
    });

    const result = await service.ingestPing(
      { transportAssignmentId: 'assignment-1', latitude: 19.076, longitude: 72.8777 },
      superAdmin,
    );

    expect(result.id).toBe('ping-super');
  });

  it('Non-existent transport assignment → throws NotFoundException (404)', async () => {
    prisma.transportAssignment.findUnique.mockResolvedValue(null);

    await expect(
      service.ingestPing(
        { transportAssignmentId: 'nonexistent-assignment', latitude: 19.076, longitude: 72.8777 },
        driverA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('Completed/Arrived transport assignment → throws BadRequestException (400)', async () => {
    prisma.transportAssignment.findUnique.mockResolvedValue({
      ...validAssignment,
      status: 'ARRIVED',
    });

    await expect(
      service.ingestPing(
        { transportAssignmentId: 'assignment-1', latitude: 19.076, longitude: 72.8777 },
        driverA,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
