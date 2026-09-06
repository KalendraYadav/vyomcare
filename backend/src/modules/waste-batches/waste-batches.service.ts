import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WasteBatchStatus, CustodyEventType, UserRole } from '@prisma/client';
import { CreateWasteBatchDto } from './dto/create-waste-batch.dto';
import { QrService } from '../qr/qr.service';
import { v4 as uuidv4 } from 'uuid';

// Haversine distance in meters (ADR-05)
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Safely cast a Prisma.JsonValue to string[].
 *
 * MySQL-compatibility note: Facility.authorizedCategoryIds is stored as a
 * JSON column (changed from PostgreSQL's native String[] array type).
 * Prisma returns it as Prisma.JsonValue — calling .includes() directly on
 * that type would fail TypeScript compilation and is unsafe at runtime.
 * This helper normalises it to a plain string[] regardless of the stored value.
 */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

@Injectable()
export class WasteBatchesService {
  constructor(
    private prisma: PrismaService,
    private qrService: QrService,
  ) {}

  async create(
    dto: CreateWasteBatchDto,
    user: { userId: string; facilityId: string | null; role: string },
  ) {
    if (!user.facilityId)
      throw new ForbiddenException('No facility associated with your account');

    // Idempotency (ADR-06)
    if (dto.idempotencyKey) {
      const existing = await this.prisma.wasteBatch.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return existing;
    }

    const category = await this.prisma.wasteCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category || !category.isActive)
      throw new BadRequestException('Invalid or inactive waste category');

    // Generate human-readable waste ID: BMW-YYYY-NNNNNN
    const year = new Date().getFullYear();
    const count = await this.prisma.wasteBatch.count();
    const wasteId = `BMW-${year}-${String(count + 1).padStart(6, '0')}`;

    const batch = await this.prisma.$transaction(async (tx) => {
      const b = await tx.wasteBatch.create({
        data: {
          wasteId,
          categoryId: dto.categoryId,
          hospitalId: user.facilityId!,
          department: dto.department,
          quantity: dto.quantity,
          unit: dto.unit,
          generatedByUserId: user.userId,
          status: WasteBatchStatus.REGISTERED,
          photoUrl: dto.photoUrl,
          idempotencyKey: dto.idempotencyKey,
        },
      });

      await tx.custodyEvent.create({
        data: {
          wasteBatchId: b.id,
          eventType: CustodyEventType.REGISTERED,
          toUserId: user.userId,
          occurredAt: new Date(),
        },
      });

      return b;
    });

    return batch;
  }

  async generateQr(
    batchId: string,
    user: { userId: string; facilityId: string | null },
  ) {
    const batch = await this.prisma.wasteBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new NotFoundException('Waste batch not found');
    if (batch.hospitalId !== user.facilityId)
      throw new ForbiddenException(
        "Cannot generate QR for another facility's batch",
      );

    const existing = await this.prisma.qrCode.findUnique({
      where: { wasteBatchId: batchId },
    });
    if (existing)
      return {
        qrCode: existing,
        qrDataUrl: await this.qrService.generateDataUrl(existing.codeValue),
      };

    const codeValue = `BIOTRACK:${batch.wasteId}:${uuidv4().slice(0, 8).toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const qr = await tx.qrCode.create({
        data: {
          wasteBatchId: batchId,
          codeValue,
          generatedByUserId: user.userId,
        },
      });
      await tx.wasteBatch.update({
        where: { id: batchId },
        data: { status: WasteBatchStatus.QR_ASSIGNED },
      });
      await tx.custodyEvent.create({
        data: {
          wasteBatchId: batchId,
          eventType: CustodyEventType.QR_ASSIGNED,
          toUserId: user.userId,
        },
      });
      return qr;
    });

    const qrDataUrl = await this.qrService.generateDataUrl(result.codeValue);
    return { qrCode: result, qrDataUrl };
  }

  async scan(
    rawCodeValue: string,
    user: { userId: string; role: string; facilityId: string | null },
  ) {
    if (!rawCodeValue || typeof rawCodeValue !== 'string') {
      throw new NotFoundException('Invalid QR code value');
    }

    const trimmed = rawCodeValue.trim();

    // 1. Exact match on qr_code.code_value
    let qr = await this.prisma.qrCode.findUnique({
      where: { codeValue: trimmed },
      include: {
        wasteBatch: {
          include: { category: true, hospital: true, qrCode: true },
        },
      },
    });

    let batch: any = qr?.wasteBatch || null;

    // 2. URL pointing to /waste-batches/:id
    if (!batch) {
      const urlMatch = trimmed.match(/\/waste-batches\/([a-f0-9-]{36})/i);
      if (urlMatch) {
        const batchId = urlMatch[1];
        batch = await this.prisma.wasteBatch.findUnique({
          where: { id: batchId },
          include: { category: true, hospital: true, qrCode: true },
        });
      }
    }

    // 3. Pattern BIOTRACK:<wasteId>:<token>
    if (!batch && trimmed.toUpperCase().startsWith('BIOTRACK:')) {
      const parts = trimmed.split(':');
      if (parts.length >= 2) {
        const extractedWasteId = parts[1];
        batch = await this.prisma.wasteBatch.findUnique({
          where: { wasteId: extractedWasteId },
          include: { category: true, hospital: true, qrCode: true },
        });
      }
    }

    // 4. Direct wasteId (e.g. BMW-2026-000006)
    if (!batch) {
      batch = await this.prisma.wasteBatch.findUnique({
        where: { wasteId: trimmed },
        include: { category: true, hospital: true, qrCode: true },
      });
    }

    // 5. Direct UUID
    if (!batch && /^[a-f0-9-]{36}$/i.test(trimmed)) {
      batch = await this.prisma.wasteBatch.findUnique({
        where: { id: trimmed },
        include: { category: true, hospital: true, qrCode: true },
      });
    }

    if (!batch) {
      throw new NotFoundException('QR code not recognized');
    }

    const validActions = this.getValidActions(
      batch.status,
      user.role as UserRole,
    );

    return {
      batch,
      qrCode: batch.qrCode || qr || null,
      validActions,
    };
  }

  async custodyHandover(
    batchId: string,
    dto: {
      eventType: CustodyEventType;
      latitude?: number;
      longitude?: number;
      notes?: string;
      photoUrl?: string;
    },
    user: { userId: string; role: string },
  ) {
    if (dto.eventType === CustodyEventType.COLLECTION_ACCEPTED) {
      if (
        user.role !== UserRole.COLLECTION_STAFF &&
        user.role !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          'Only collection staff or super admin can accept waste into collection',
        );
      }
    } else if (dto.eventType === CustodyEventType.TRANSPORT_STARTED) {
      if (
        user.role !== UserRole.TRANSPORT_PERSONNEL &&
        user.role !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          'Only transport personnel or super admin can start a transport run',
        );
      }
    }

    const batch = await this.prisma.wasteBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new NotFoundException('Waste batch not found');

    const newStatus = this.getNextStatus(batch.status, dto.eventType);
    if (!newStatus)
      throw new ConflictException(
        `Invalid status transition from ${batch.status} via ${dto.eventType}`,
      );

    return this.prisma.$transaction(async (tx) => {
      await tx.custodyEvent.create({
        data: {
          wasteBatchId: batchId,
          eventType: dto.eventType,
          fromUserId: batch.currentCustodianUserId,
          toUserId: user.userId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          notes: dto.notes,
          photoUrl: dto.photoUrl,
        },
      });

      return tx.wasteBatch.update({
        where: { id: batchId },
        data: {
          status: newStatus,
          currentCustodianUserId: user.userId,
          currentLatitude: dto.latitude,
          currentLongitude: dto.longitude,
        },
      });
    });
  }

  async verifyArrival(
    batchId: string,
    dto: { latitude: number; longitude: number },
    user: { userId: string; facilityId: string | null; role: string },
  ) {
    if (!user.facilityId) throw new ForbiddenException('No facility');

    const [batch, facility] = await Promise.all([
      this.prisma.wasteBatch.findUnique({
        where: { id: batchId },
        include: { category: true },
      }),
      this.prisma.facility.findUnique({ where: { id: user.facilityId } }),
    ]);

    if (!batch) throw new NotFoundException('Batch not found');
    if (!facility) throw new ForbiddenException('Facility not found');

    // Step 1–2: facility registration check (done by the fact user has a facility_id and it's APPROVED)
    if (facility.status !== 'APPROVED')
      throw new ForbiddenException(
        'This facility is not currently approved to receive waste.',
      );

    // Step 3: Category authorization
    // authorizedCategoryIds is a Json column (MySQL-compatible). Cast via asStringArray().
    if (
      !asStringArray(facility.authorizedCategoryIds).includes(batch.categoryId)
    ) {
      throw new ForbiddenException(
        `This facility isn't authorized to receive ${batch.category.name} waste.`,
      );
    }

    // Step 4: Geofence
    if (facility.latitude && facility.longitude && facility.geofenceRadiusM) {
      const dist = haversineMeters(
        dto.latitude,
        dto.longitude,
        facility.latitude,
        facility.longitude,
      );
      if (dist > facility.geofenceRadiusM) {
        throw new ForbiddenException(
          `You're outside the registered facility boundary (${Math.round(dist)}m away, limit ${facility.geofenceRadiusM}m).`,
        );
      }
    }

    // Step 5: Time limit check (raises alert but doesn't block)
    const rule = await this.prisma.complianceRule.findUnique({
      where: {
        wasteCategoryId_stage: {
          wasteCategoryId: batch.categoryId,
          stage: 'TRANSPORT',
        },
      },
    });
    if (rule) {
      const collectionEvent = await this.prisma.custodyEvent.findFirst({
        where: { wasteBatchId: batchId, eventType: 'COLLECTION_ACCEPTED' },
        orderBy: { occurredAt: 'desc' },
      });
      if (collectionEvent) {
        const elapsed =
          (Date.now() - collectionEvent.occurredAt.getTime()) / 1000 / 3600;
        if (elapsed > rule.maxDurationHours) {
          await this.prisma.alert.create({
            data: {
              wasteBatchId: batchId,
              type: 'DISPOSAL_DELAY',
              severity: 'HIGH',
              status: 'OPEN',
            },
          });
        }
      }
    }

    return this.custodyHandover(
      batchId,
      {
        eventType: CustodyEventType.ARRIVAL_VERIFIED,
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
      user,
    );
  }

  async confirmTreatment(
    batchId: string,
    dto: { photoUrl: string; latitude?: number; longitude?: number },
    user: { userId: string },
  ) {
    if (!dto.photoUrl)
      throw new BadRequestException('A photo is required to confirm treatment');

    const batch = await this.prisma.wasteBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    if (batch.status !== 'RECEIVED')
      throw new ConflictException(
        'Batch must be in RECEIVED status to confirm treatment',
      );

    return this.prisma.$transaction(async (tx) => {
      await tx.custodyEvent.create({
        data: {
          wasteBatchId: batchId,
          eventType: CustodyEventType.TREATMENT_CONFIRMED,
          fromUserId: batch.currentCustodianUserId,
          toUserId: user.userId,
          photoUrl: dto.photoUrl,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
      // Auto-transition to TREATED, then VERIFIED_CLOSED
      await tx.wasteBatch.update({
        where: { id: batchId },
        data: { status: WasteBatchStatus.TREATED },
      });
      const closed = await tx.wasteBatch.update({
        where: { id: batchId },
        data: { status: WasteBatchStatus.VERIFIED_CLOSED },
      });
      await tx.custodyEvent.create({
        data: {
          wasteBatchId: batchId,
          eventType: CustodyEventType.VERIFIED_CLOSED,
          toUserId: user.userId,
        },
      });
      return closed;
    });
  }

  async getHistory(
    batchId: string,
    user?: { role: string; facilityId: string | null },
  ) {
    // Enforce tenant scoping check via findById
    await this.findById(batchId, user);

    return this.prisma.custodyEvent.findMany({
      where: { wasteBatchId: batchId },
      orderBy: { occurredAt: 'asc' },
      include: {
        fromUser: { select: { id: true, name: true, role: true } },
        toUser: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async findById(
    id: string,
    user?: { role: string; facilityId: string | null },
  ) {
    const batch = await this.prisma.wasteBatch.findUnique({
      where: { id },
      include: {
        category: true,
        hospital: true,
        qrCode: true,
        alerts: { where: { status: { not: 'RESOLVED' } } },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    // Hospital roles are restricted to batches originating from their facility (P2-03)
    if (
      user &&
      (
        [UserRole.HOSPITAL_ADMIN, UserRole.HOSPITAL_STAFF] as UserRole[]
      ).includes(user.role as UserRole)
    ) {
      if (batch.hospitalId !== user.facilityId) {
        throw new ForbiddenException(
          'You are not authorized to view waste batches from another facility',
        );
      }
    }

    return batch;
  }

  async findAll(query: {
    status?: string;
    hospitalId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 25;
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.hospitalId) where.hospitalId = query.hospitalId;

    const [items, total] = await Promise.all([
      this.prisma.wasteBatch.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          hospital: { select: { id: true, name: true } },
        },
      }),
      this.prisma.wasteBatch.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  private getValidActions(status: WasteBatchStatus, role: UserRole): string[] {
    const map: Partial<
      Record<WasteBatchStatus, Partial<Record<UserRole, string[]>>>
    > = {
      QR_ASSIGNED: {
        [UserRole.COLLECTION_STAFF]: ['ACCEPT_CUSTODY'],
        [UserRole.SUPER_ADMIN]: ['ACCEPT_CUSTODY'],
      },
      COLLECTED: {
        [UserRole.TRANSPORT_PERSONNEL]: ['START_TRANSPORT'],
        [UserRole.SUPER_ADMIN]: ['START_TRANSPORT'],
      },
      IN_TRANSIT: {
        [UserRole.TREATMENT_FACILITY_STAFF]: ['VERIFY_ARRIVAL'],
        [UserRole.SUPER_ADMIN]: ['VERIFY_ARRIVAL'],
      },
      RECEIVED: {
        [UserRole.TREATMENT_FACILITY_STAFF]: ['CONFIRM_TREATMENT'],
        [UserRole.SUPER_ADMIN]: ['CONFIRM_TREATMENT'],
      },
    };
    return map[status]?.[role] || [];
  }

  private getNextStatus(
    current: WasteBatchStatus,
    event: CustodyEventType,
  ): WasteBatchStatus | null {
    const validTransitions: Partial<
      Record<CustodyEventType, { from: WasteBatchStatus; to: WasteBatchStatus }>
    > = {
      [CustodyEventType.COLLECTION_ACCEPTED]: {
        from: WasteBatchStatus.QR_ASSIGNED,
        to: WasteBatchStatus.COLLECTED,
      },
      [CustodyEventType.TRANSPORT_STARTED]: {
        from: WasteBatchStatus.COLLECTED,
        to: WasteBatchStatus.IN_TRANSIT,
      },
      [CustodyEventType.ARRIVAL_VERIFIED]: {
        from: WasteBatchStatus.IN_TRANSIT,
        to: WasteBatchStatus.RECEIVED,
      },
      [CustodyEventType.TREATMENT_CONFIRMED]: {
        from: WasteBatchStatus.RECEIVED,
        to: WasteBatchStatus.TREATED,
      },
      [CustodyEventType.VERIFIED_CLOSED]: {
        from: WasteBatchStatus.TREATED,
        to: WasteBatchStatus.VERIFIED_CLOSED,
      },
    };

    const rule = validTransitions[event];
    if (!rule || rule.from !== current) {
      return null;
    }
    return rule.to;
  }
}
