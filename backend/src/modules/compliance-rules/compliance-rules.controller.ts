import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ComplianceRulesService } from './compliance-rules.service';

@Controller('compliance-rules')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ComplianceRulesController {
  constructor(private readonly svc: ComplianceRulesService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.GOVERNMENT_AUTHORITY,
    UserRole.HOSPITAL_ADMIN,
  )
  findAll() {
    return this.svc.findAll();
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_AUTHORITY)
  update(@Param('id') id: string, @Body('maxDurationHours') h: number) {
    return this.svc.update(id, h);
  }
}
