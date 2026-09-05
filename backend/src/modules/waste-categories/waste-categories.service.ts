import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WasteCategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.wasteCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
  findAllAdmin() {
    return this.prisma.wasteCategory.findMany({ orderBy: { name: 'asc' } });
  }
  create(dto: any) {
    return this.prisma.wasteCategory.create({ data: dto });
  }
  update(id: string, dto: any) {
    return this.prisma.wasteCategory.update({ where: { id }, data: dto });
  }
  deactivate(id: string) {
    return this.prisma.wasteCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
