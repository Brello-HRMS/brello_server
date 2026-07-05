import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';

import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES, QUEUE_TOKENS } from '../../queue/queue.constants';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { EmailNotificationService } from '../services/email-notification.service';

@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorker.name);
  private worker: Worker;

  constructor(
    private readonly emailService: EmailNotificationService,
    @Inject(QUEUE_TOKENS.EMAIL_DLQ) private readonly dlq: Queue,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      QUEUE_NAMES.EMAIL,
      async (job: Job<SendNotificationDto>) => {
        await this.emailService.send(job.data);
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
      this.logger.log(`Email job ${job.id} completed`);
    });

    this.worker.on('failed', async (job, err) => {
      const maxAttempts = DEFAULT_JOB_OPTIONS.attempts;
      if (job && job.attemptsMade >= maxAttempts) {
        this.logger.warn(`Email job ${job.id} dead-lettered after ${job.attemptsMade} attempts`);
        await this.dlq.add('dead', {
          originalJob: job.name,
          data: job.data,
          error: err.message,
          failedAt: new Date().toISOString(),
        });
      }
    });

    this.logger.log('EmailWorker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
