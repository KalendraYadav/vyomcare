import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { FacilitiesService } from './facilities.service';

@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly svc: FacilitiesService) {}

  // Public registration endpoint
  @Post()
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: any) {
    return this.svc.register(dto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_AUTHORITY)
  findAll(@Query() query: any) {
    return this.svc.findAll(query);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  approve(
    @Param('id') id: string,
    @Body() dto: { action: 'APPROVED' | 'SUSPENDED'; reason?: string },
  ) {
    return this.svc.approve(id, dto.action);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: any) {
    return this.svc.update(id, dto);
  }
}
