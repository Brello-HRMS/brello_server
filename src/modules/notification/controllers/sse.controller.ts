import { Controller, Logger, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';

import { SseJwtGuard } from '../../../common/guards/sse-jwt.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { RedisService } from '../../../common/redis/redis.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(SseJwtGuard)
@Controller('notifications')
export class SseController {
  private readonly logger = new Logger(SseController.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * SSE endpoint for real-time in-app notifications.
   * The browser EventSource cannot set Authorization headers, so the JWT is
   * passed as a `?token=` query parameter and validated by SseJwtGuard.
   *
   * Each connection creates a dedicated Redis subscriber that listens on
   * `notifications:user:{userId}` and pushes MessageEvents to the client.
   */
  @Sse('stream')
  @ApiOperation({
    summary: 'SSE stream for real-time notifications (pass JWT as ?token=)',
  })
  stream(
    @LoggedInUser() user: LoggedInUserInterface,
  ): Observable<MessageEvent> {
    return new Observable((observer) => {
      const channel = `notifications:user:${user.userId}`;
      const subscriber = this.redisService.createSubscriber();

      subscriber.subscribe(channel, (err) => {
        if (err) {
          this.logger.error(`Failed to subscribe to ${channel}: ${err.message}`);
          observer.error(err);
          subscriber.quit();
        }
      });

      subscriber.on('message', (_ch: string, message: string) => {
        try {
          observer.next({ data: JSON.parse(message) } as MessageEvent);
        } catch {
          // ignore malformed messages
        }
      });

      subscriber.on('error', (err) => {
        this.logger.error(`Redis subscriber error: ${err.message}`);
      });

      return () => {
        subscriber.unsubscribe(channel).finally(() => subscriber.quit());
      };
    });
  }
}
