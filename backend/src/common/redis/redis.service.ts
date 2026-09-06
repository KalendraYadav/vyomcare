import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: IORedis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      const redisUrl =
        this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
      this.client = new IORedis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        retryStrategy: (times) => {
          const delay = Math.min(times * 500, 5000);
          return delay;
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis client connected successfully');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis connection warning: ${err.message}`);
      });
    } catch (err: any) {
      this.logger.warn(`Redis initialization warning: ${err?.message || err}`);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch (err: any) {
      this.logger.warn(`Redis get error on key ${key}: ${err.message}`);
      return null;
    }
  }

  async set(
    key: string,
    value: string | number,
    ttlSeconds?: number,
  ): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      if (ttlSeconds) {
        await this.client.set(key, String(value), 'EX', ttlSeconds);
      } else {
        await this.client.set(key, String(value));
      }
    } catch (err: any) {
      this.logger.warn(`Redis set error on key ${key}: ${err.message}`);
    }
  }

  async incr(key: string): Promise<number | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      return await this.client.incr(key);
    } catch (err: any) {
      this.logger.warn(`Redis incr error on key ${key}: ${err.message}`);
      return null;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (err: any) {
      this.logger.warn(`Redis expire error on key ${key}: ${err.message}`);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.client || !this.isConnected) return -1;
    try {
      return await this.client.ttl(key);
    } catch (err: any) {
      this.logger.warn(`Redis ttl error on key ${key}: ${err.message}`);
      return -1;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`Redis del error on key ${key}: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // ignore on shutdown
      }
    }
  }
}
