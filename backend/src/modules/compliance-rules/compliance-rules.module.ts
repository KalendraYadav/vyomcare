import { Module } from '@nestjs/common';
import { ComplianceRulesService } from './compliance-rules.service';
import { ComplianceRulesController } from './compliance-rules.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ComplianceRulesController],
  providers: [ComplianceRulesService],
  exports: [ComplianceRulesService],
})
export class ComplianceRulesModule {}
