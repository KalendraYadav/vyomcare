import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
