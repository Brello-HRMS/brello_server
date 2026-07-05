import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly publisher: Redis;

  constructor(private readonly configService: ConfigService) {
    this.publisher = this.createClient('publisher');
  }

  private createClient(label: string): Redis {
    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password');

    const client = new Redis({ host, port, ...(password ? { password } : {}), lazyConnect: false });

    client.on('connect', () => this.logger.log(`Redis ${label} connected`));
    client.on('error', (err) => this.logger.error(`Redis ${label} error: ${err.message}`));

    return client;
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.publisher.publish(channel, message);
  }

  createSubscriber(): Redis {
    return this.createClient('subscriber');
  }

  async onModuleDestroy(): Promise<void> {
    await this.publisher.quit();
  }
}
