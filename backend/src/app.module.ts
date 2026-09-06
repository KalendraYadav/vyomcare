import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { WasteCategoriesModule } from './modules/waste-categories/waste-categories.module';
import { WasteBatchesModule } from './modules/waste-batches/waste-batches.module';
import { QrModule } from './modules/qr/qr.module';
import { CustodyEventsModule } from './modules/custody-events/custody-events.module';
import { TransportModule } from './modules/transport/transport.module';
import { GpsModule } from './modules/gps/gps.module';
import { ComplianceRulesModule } from './modules/compliance-rules/compliance-rules.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsGateway } from './gateways/notifications.gateway';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    FacilitiesModule,
    WasteCategoriesModule,
    WasteBatchesModule,
    QrModule,
    CustodyEventsModule,
    TransportModule,
    GpsModule,
    ComplianceRulesModule,
    AlertsModule,
    DashboardsModule,
    NotificationsModule,
    AuditLogModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    AppService,
    NotificationsGateway,
  ],
})
export class AppModule {}
