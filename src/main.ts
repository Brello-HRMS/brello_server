import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express } from 'express';

/**
 * Shared application setup logic
 */
export async function setupApp(
  expressInstance: Express,
): Promise<INestApplication> {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

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

  await app.init();
  return app;
}

/**
 * Standard bootstrap for local development
 */
async function startLocal() {
  const server = express();
  const app = await setupApp(server);

  const config: ConfigService = app.get(ConfigService);
  const PORT: number | undefined = config.get<number>('http.port');

  await app.listen(PORT ?? 8000);
  console.log(`
  🚀 Application is running on: http://localhost:${PORT ?? 8000}
  `);
}

// Check if running in a non-serverless environment to start normally
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  startLocal().catch((err) => {
    console.error('Error during local bootstrap:', err);
    process.exit(1);
  });
}
