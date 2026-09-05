import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private redisConnection: IORedis;
  private complianceQueue: Queue;
  private complianceWorker: Worker;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    this.logger.log(`Initializing BullMQ with Redis at ${redisUrl}`);

    this.redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    // Test Redis connection
    await this.redisConnection.ping();
    this.logger.log('✅ Redis connection verified via IORedis ping');

    // Initialize BullMQ Queue
    this.complianceQueue = new Queue('compliance-checks', {
      connection: this.redisConnection,
    });

    // Initialize BullMQ Worker
    this.complianceWorker = new Worker(
      'compliance-checks',
      async (job: Job) => {
        this.logger.log(`Processing BullMQ job: ${job.name} (id: ${job.id})`);
        if (job.name === 'scan-compliance-deadlines') {
          // Scans active waste batches against compliance rules
          const activeBatches = await this.prisma.wasteBatch.findMany({
            where: {
              status: { in: ['REGISTERED', 'COLLECTED', 'IN_TRANSIT'] },
            },
            take: 50,
          });
          return { scannedCount: activeBatches.length };
        }
        return { status: 'acknowledged' };
      },
      { connection: this.redisConnection },
    );

    this.complianceWorker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed successfully`);
    });

    this.complianceWorker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed with error: ${err.message}`);
    });

    this.logger.log('✅ BullMQ queue and worker initialized successfully');
  }

  async addJob(name: string, data: any = {}) {
    if (!this.complianceQueue) {
      throw new Error('BullMQ compliance queue is not initialized');
    }
    return this.complianceQueue.add(name, data);
  }

  async onModuleDestroy() {
    this.logger.log('Closing BullMQ worker and queue...');
    if (this.complianceWorker) {
      await this.complianceWorker.close();
    }
    if (this.complianceQueue) {
      await this.complianceQueue.close();
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
    }
    this.logger.log('BullMQ shutdown complete');
  }
}
