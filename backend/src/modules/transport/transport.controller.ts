import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { TransportService } from './transport.service';

@Controller('transport')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TransportController {
  constructor(private readonly svc: TransportService) {}

  @Post('assignments')
  @Roles(
    UserRole.COLLECTION_STAFF,
    UserRole.HOSPITAL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  create(@Body() dto: any) {
    return this.svc.createAssignment(dto);
  }

  @Get('active')
  @Roles(
    UserRole.GOVERNMENT_AUTHORITY,
    UserRole.HOSPITAL_ADMIN,
    UserRole.TRANSPORT_PERSONNEL,
    UserRole.SUPER_ADMIN,
  )
  getActive(@CurrentUser() user: any) {
    if (user.role === UserRole.TRANSPORT_PERSONNEL)
      return this.svc.getMyAssignment(user.userId);
    return this.svc.getActive();
  }

  @Get('vehicles')
  @Roles(
    UserRole.COLLECTION_STAFF,
    UserRole.HOSPITAL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  listVehicles() {
    return this.svc.listVehicles();
  }

  @Get('my-assignment')
  @Roles(UserRole.TRANSPORT_PERSONNEL)
  myAssignment(@CurrentUser() user: any) {
    return this.svc.getMyAssignment(user.userId);
  }
}
