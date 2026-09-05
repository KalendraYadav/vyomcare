import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuditLogService } from './audit-log.service';

@Controller('audit-log')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AuditLogController {
  constructor(private readonly svc: AuditLogService) {}

  @Get() findAll(@Query() q: any) {
    return this.svc.findAll(q);
  }
}
