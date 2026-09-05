import {
  Controller,
  Post,
  Get,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { WasteBatchesService } from './waste-batches.service';
import {
  CreateWasteBatchDto,
  CustodyHandoverDto,
  VerifyArrivalDto,
  ConfirmTreatmentDto,
  ScanDto,
} from './dto/create-waste-batch.dto';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class WasteBatchesController {
  constructor(private readonly svc: WasteBatchesService) {}

  @Post('waste-batches')
  @Roles(UserRole.HOSPITAL_ADMIN, UserRole.HOSPITAL_STAFF, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateWasteBatchDto, @CurrentUser() user: any) {
    return this.svc.create(dto, user);
  }

  @Post('waste-batches/:id/qr')
  @Roles(UserRole.HOSPITAL_ADMIN, UserRole.HOSPITAL_STAFF, UserRole.SUPER_ADMIN)
  generateQr(@Param('id') id: string, @CurrentUser() user: any) {
    return this.svc.generateQr(id, user);
  }

  @Post('scan')
  @Roles(
    UserRole.COLLECTION_STAFF,
    UserRole.TRANSPORT_PERSONNEL,
    UserRole.TREATMENT_FACILITY_STAFF,
    UserRole.SUPER_ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  scan(@Body() dto: ScanDto, @CurrentUser() user: any) {
    return this.svc.scan(dto.codeValue, user);
  }

  @Post('waste-batches/:id/custody-events')
  @Roles(
    UserRole.COLLECTION_STAFF,
    UserRole.TRANSPORT_PERSONNEL,
    UserRole.SUPER_ADMIN,
  )
  custodyHandover(
    @Param('id') id: string,
    @Body() dto: CustodyHandoverDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.custodyHandover(id, dto as any, user);
  }

  @Post('waste-batches/:id/verify-arrival')
  @Roles(UserRole.TREATMENT_FACILITY_STAFF, UserRole.SUPER_ADMIN)
  verifyArrival(
    @Param('id') id: string,
    @Body() dto: VerifyArrivalDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.verifyArrival(id, dto, user);
  }

  @Post('waste-batches/:id/confirm-treatment')
  @Roles(UserRole.TREATMENT_FACILITY_STAFF, UserRole.SUPER_ADMIN)
  confirmTreatment(
    @Param('id') id: string,
    @Body() dto: ConfirmTreatmentDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.confirmTreatment(id, dto, user);
  }

  @Get('waste-batches/:id/history')
  getHistory(@Param('id') id: string) {
    return this.svc.getHistory(id);
  }

  @Get('waste-batches/:id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Get('waste-batches')
  findAll(@Query() query: any, @CurrentUser() user: any) {
    // Hospital roles only see their own facility's batches
    const hospitalId = [
      UserRole.HOSPITAL_ADMIN,
      UserRole.HOSPITAL_STAFF,
    ].includes(user.role)
      ? user.facilityId
      : query.hospitalId;
    return this.svc.findAll({ ...query, hospitalId });
  }
}
