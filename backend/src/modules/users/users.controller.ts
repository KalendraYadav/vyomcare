import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { extractRequestBaseUrl } from '../../common/email/email.service';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const appBaseUrl = extractRequestBaseUrl(req);
    return this.svc.create(dto, user, appBaseUrl);
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
    @CurrentUser() user: any,
  ) {
    return this.svc.updateStatus(id, status, user);
  }
}
