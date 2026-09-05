import { Module } from '@nestjs/common';
import { WasteCategoriesService } from './waste-categories.service';
import { WasteCategoriesController } from './waste-categories.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WasteCategoriesController],
  providers: [WasteCategoriesService],
  exports: [WasteCategoriesService],
})
export class WasteCategoriesModule {}
