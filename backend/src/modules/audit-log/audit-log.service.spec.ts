import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'audit-log-uuid-1',
            ...data,
            occurredAt: new Date(),
          }),
        ),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'audit-log-uuid-1',
            action: 'USER_PROVISIONED',
            entityType: 'User',
            entityId: 'user-uuid-1',
            occurredAt: new Date(),
          },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  it('should create an audit log record with actor and metadata', async () => {
    const res = await service.log({
      actorUserId: 'admin-uuid-1',
      action: 'USER_PROVISIONED',
      entityType: 'User',
      entityId: 'user-uuid-1',
      metadata: { role: 'HOSPITAL_STAFF', email: 'test@hospital.in' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'admin-uuid-1',
        action: 'USER_PROVISIONED',
        entityType: 'User',
        entityId: 'user-uuid-1',
        metadata: { role: 'HOSPITAL_STAFF', email: 'test@hospital.in' },
      },
    });
    expect(res.id).toBe('audit-log-uuid-1');
  });

  it('should find all audit logs filtered by entityType and actorUserId', async () => {
    const res = await service.findAll({
      entityType: 'User',
      actorUserId: 'admin-uuid-1',
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        entityType: 'User',
        actorUserId: 'admin-uuid-1',
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
    expect(res).toHaveLength(1);
    expect(res[0].action).toBe('USER_PROVISIONED');
  });
});
