import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { WasteCategoriesService } from './waste-categories.service';

@Controller('waste-categories')
@UseGuards(AuthGuard('jwt'))
export class WasteCategoriesController {
  constructor(private readonly svc: WasteCategoriesService) {}

  @Get() findAll() {
    return this.svc.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: any) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: any) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  deactivate(@Param('id') id: string) {
    return this.svc.deactivate(id);
  }
}
