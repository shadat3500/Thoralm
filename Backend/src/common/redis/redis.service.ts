import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (err) {
      this.logger.warn(
        `Redis not reachable at boot (holds/denylist/presence will fail until it is): ${String(err)}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }

  getClient() {
    return this.client;
  }

  async ping(): Promise<string> {
    await this.ensureReady();
    return this.client.ping();
  }

  async denyAccessJti(jti: string, ttlSeconds: number) {
    try {
      await this.ensureReady();
      await this.client.set(
        `auth:deny:${jti}`,
        '1',
        'EX',
        Math.max(ttlSeconds, 1),
      );
    } catch (err) {
      this.logger.warn(`Could not denylist access jti: ${String(err)}`);
    }
  }

  async isAccessDenied(jti: string): Promise<boolean> {
    try {
      await this.ensureReady();
      return (await this.client.get(`auth:deny:${jti}`)) === '1';
    } catch {
      return false;
    }
  }

  async revokeUserAccess(userId: string) {
    try {
      await this.ensureReady();
      const now = Math.floor(Date.now() / 1000);
      await this.client.set(
        `auth:revoked:${userId}`,
        String(now),
        'EX',
        31 * 86400,
      );
    } catch (err) {
      this.logger.warn(`Could not revoke user access: ${String(err)}`);
    }
  }

  async isUserAccessRevoked(userId: string, iat?: number): Promise<boolean> {
    if (iat == null) return false;
    try {
      await this.ensureReady();
      const raw = await this.client.get(`auth:revoked:${userId}`);
      if (!raw) return false;
      return iat < Number(raw);
    } catch {
      return false;
    }
  }

  private async ensureReady() {
    if (this.client.status !== 'ready') {
      await this.client.connect();
    }
  }
}
