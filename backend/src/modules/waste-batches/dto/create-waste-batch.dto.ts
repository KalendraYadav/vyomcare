import {
  IsString,
  IsUUID,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';
import { WasteUnit } from '@prisma/client';

export class CreateWasteBatchDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  department: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsEnum(WasteUnit)
  unit: WasteUnit;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class CustodyHandoverDto {
  @IsEnum([
    'COLLECTION_ACCEPTED',
    'TRANSPORT_STARTED',
    'ARRIVAL_VERIFIED',
    'TREATMENT_CONFIRMED',
  ])
  eventType: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

export class VerifyArrivalDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

export class ConfirmTreatmentDto {
  @IsString()
  photoUrl: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class ScanDto {
  @IsString()
  codeValue: string;
}
