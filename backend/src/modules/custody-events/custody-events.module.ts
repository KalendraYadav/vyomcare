import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';

/**
 * CustodyEventsModule
 *
 * Custody event creation is handled inline within WasteBatchesModule
 * (each status transition creates a CustodyEvent in the same transaction).
 * This module exists as the registered app-level boundary; it exports
 * nothing additional — the Prisma service reaches custody_event directly
 * through WasteBatchesModule and other modules that already import PrismaModule.
 */
@Module({
  imports: [PrismaModule],
})
export class CustodyEventsModule {}
