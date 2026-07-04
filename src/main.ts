import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ConfigService } from '@nestjs/config';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { QUEUE_TOKENS } from './modules/queue/queue.constants';

// Bootstrap Application - Initializes and configures the NestJS application
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Cookie parser — required for reading HttpOnly refresh token cookies
  app.use(cookieParser());

  // Enable CORS with credentials (required for cross-origin cookie support)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter for consistent error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global transform interceptor for consistent success responses
  app.useGlobalInterceptors(new TransformInterceptor());

  // Set global API prefix from YAML properties
  const config: ConfigService = app.get(ConfigService);
  const apiPrefix = config.get<string>('http.apiPrefix', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // BullBoard dashboard — dev only, no auth guard (add platform-admin gate in prod)
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({
    queues: [
      new BullMQAdapter(app.get<Queue>(QUEUE_TOKENS.EMAIL)),
      new BullMQAdapter(app.get<Queue>(QUEUE_TOKENS.EMAIL_DLQ)),
      new BullMQAdapter(app.get<Queue>(QUEUE_TOKENS.IN_APP)),
      new BullMQAdapter(app.get<Queue>(QUEUE_TOKENS.IN_APP_DLQ)),
      new BullMQAdapter(app.get<Queue>(QUEUE_TOKENS.PUSH)),
      new BullMQAdapter(app.get<Queue>(QUEUE_TOKENS.PUSH_DLQ)),
    ],
    serverAdapter,
  });
  app.use('/admin/queues', serverAdapter.getRouter());

  const PORT: number | undefined = config.get<number>('http.port');

  await app.listen(PORT ?? 8000);
  console.log(`
  🚀 Application is running on: http://localhost:${PORT}
  📊 BullBoard: http://localhost:${PORT}/admin/queues
  `);
}

bootstrap();
