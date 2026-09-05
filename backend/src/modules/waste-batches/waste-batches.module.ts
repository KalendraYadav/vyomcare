import { Module } from '@nestjs/common';
import { WasteBatchesService } from './waste-batches.service';
import { WasteBatchesController } from './waste-batches.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { QrModule } from '../qr/qr.module';

@Module({
  imports: [PrismaModule, QrModule],
  controllers: [WasteBatchesController],
  providers: [WasteBatchesService],
  exports: [WasteBatchesService],
})
export class WasteBatchesModule {}
