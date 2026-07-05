import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, QUEUE_TOKENS } from './queue.constants';

function queueProvider(token: string, name: string) {
  return {
    provide: token,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      return new Queue(name, {
        connection: {
          host: config.get<string>('redis.host', 'localhost'),
          port: config.get<number>('redis.port', 6379),
          password: config.get<string>('redis.password') || undefined,
        },
      });
    },
  };
}

const queueProviders = [
  queueProvider(QUEUE_TOKENS.EMAIL, QUEUE_NAMES.EMAIL),
  queueProvider(QUEUE_TOKENS.EMAIL_DLQ, QUEUE_NAMES.EMAIL_DLQ),
  queueProvider(QUEUE_TOKENS.IN_APP, QUEUE_NAMES.IN_APP),
  queueProvider(QUEUE_TOKENS.IN_APP_DLQ, QUEUE_NAMES.IN_APP_DLQ),
  queueProvider(QUEUE_TOKENS.PUSH, QUEUE_NAMES.PUSH),
  queueProvider(QUEUE_TOKENS.PUSH_DLQ, QUEUE_NAMES.PUSH_DLQ),
];

@Global()
@Module({
  imports: [ConfigModule],
  providers: queueProviders,
  exports: queueProviders.map((p) => p.provide),
})
export class QueueModule {}
