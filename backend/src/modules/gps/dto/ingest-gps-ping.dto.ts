import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class IngestGpsPingDto {
  @IsUUID(4, { message: 'transportAssignmentId must be a valid UUID' })
  @IsNotEmpty({ message: 'transportAssignmentId is required' })
  transportAssignmentId: string;

  @IsNumber({}, { message: 'latitude must be a valid number' })
  @Min(-90, { message: 'latitude cannot be less than -90' })
  @Max(90, { message: 'latitude cannot be greater than 90' })
  latitude: number;

  @IsNumber({}, { message: 'longitude must be a valid number' })
  @Min(-180, { message: 'longitude cannot be less than -180' })
  @Max(180, { message: 'longitude cannot be greater than 180' })
  longitude: number;

  @IsOptional()
  @IsNumber({}, { message: 'speed must be a number' })
  speed?: number;

  @IsOptional()
  @IsNumber({}, { message: 'heading must be a number' })
  heading?: number;

  @IsOptional()
  @IsNumber({}, { message: 'accuracy must be a number' })
  accuracy?: number;

  @IsOptional()
  @IsString({ message: 'recordedAt must be a string timestamp' })
  recordedAt?: string;
}
