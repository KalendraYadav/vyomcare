import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { GpsService } from './gps.service';
import { IngestGpsPingDto } from './dto/ingest-gps-ping.dto';

@Controller('gps-pings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class GpsController {
  constructor(private readonly svc: GpsService) {}

  @Post()
  @Roles(UserRole.TRANSPORT_PERSONNEL, UserRole.SUPER_ADMIN)
  ingest(@Body() dto: IngestGpsPingDto, @CurrentUser() user: any) {
    return this.svc.ingestPing(dto, user);
  }

  @Get(':assignmentId')
  getPings(@Param('assignmentId') id: string) {
    return this.svc.getLatestPings(id);
  }
}
