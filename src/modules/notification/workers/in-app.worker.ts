import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';

import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES, QUEUE_TOKENS } from '../../queue/queue.constants';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { InAppNotificationService } from '../services/in-app-notification.service';

@Injectable()
export class InAppWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InAppWorker.name);
  private worker: Worker;

  constructor(
    private readonly inAppService: InAppNotificationService,
    @Inject(QUEUE_TOKENS.IN_APP_DLQ) private readonly dlq: Queue,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      QUEUE_NAMES.IN_APP,
      async (job: Job<SendNotificationDto>) => {
        await this.inAppService.send(job.data);
      },
      {
        connection: {
          host: this.configService.get<string>('redis.host', 'localhost'),
          port: this.configService.get<number>('redis.port', 6379),
          password: this.configService.get<string>('redis.password') || undefined,
        },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`In-app job ${job.id} completed`);
    });

    this.worker.on('failed', async (job, err) => {
      const maxAttempts = DEFAULT_JOB_OPTIONS.attempts;
      if (job && job.attemptsMade >= maxAttempts) {
        this.logger.warn(`In-app job ${job.id} dead-lettered after ${job.attemptsMade} attempts`);
        await this.dlq.add('dead', {
          originalJob: job.name,
          data: job.data,
          error: err.message,
          failedAt: new Date().toISOString(),
        });
      }
    });

    this.logger.log('InAppWorker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
