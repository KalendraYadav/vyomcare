import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FacilitiesService {
  constructor(private prisma: PrismaService) {}

  async register(dto: any) {
    return this.prisma.facility.create({ data: { ...dto, status: 'PENDING' } });
  }

  async approve(id: string, action: 'APPROVED' | 'SUSPENDED') {
    return this.prisma.facility.update({
      where: { id },
      data: { status: action },
    });
  }

  async findAll(query: any) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    return this.prisma.facility.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.facility.findUniqueOrThrow({ where: { id } });
  }

  async update(id: string, dto: any) {
    return this.prisma.facility.update({ where: { id }, data: dto });
  }
}
