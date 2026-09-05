import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { DashboardsService } from './dashboards.service';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DashboardsController {
  constructor(private readonly svc: DashboardsService) {}

  @Get('hospital')
  @Roles(UserRole.HOSPITAL_ADMIN, UserRole.HOSPITAL_STAFF, UserRole.SUPER_ADMIN)
  getHospital(@CurrentUser() user: any) {
    return this.svc.getHospitalDashboard(user.facilityId);
  }

  @Get('facility')
  @Roles(UserRole.TREATMENT_FACILITY_STAFF, UserRole.SUPER_ADMIN)
  getFacility(@CurrentUser() user: any) {
    return this.svc.getFacilityDashboard(user.facilityId);
  }

  @Get('government')
  @Roles(UserRole.GOVERNMENT_AUTHORITY, UserRole.SUPER_ADMIN)
  getGovernment() {
    return this.svc.getGovernmentDashboard();
  }
}
