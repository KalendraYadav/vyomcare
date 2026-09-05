import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { AlertsService } from './alerts.service';

@Controller('alerts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AlertsController {
  constructor(private readonly svc: AlertsService) {}

  @Get()
  findAll(@Query() q: any, @CurrentUser() user: any) {
    return this.svc.findAll(q, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_AUTHORITY)
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.svc.update(id, dto, user.userId);
  }
}
