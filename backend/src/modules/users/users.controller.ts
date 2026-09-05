import {
  Controller,
  Get,
  Post,
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
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  create(@Body() dto: any, @CurrentUser() user: any) {
    return this.svc.create(dto, user);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.svc.findAll(query, user);
  }

  @Get('me')
  findMe(@CurrentUser() user: any) {
    return this.svc.findMe(user.userId);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'ACTIVE' | 'DEACTIVATED',
  ) {
    return this.svc.updateStatus(id, status);
  }
}
