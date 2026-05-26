import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ConfigService } from '@nestjs/config';

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

  const PORT: number | undefined = config.get<number>('http.port');

  await app.listen(PORT ?? 8000);
  console.log(`
  🚀 Application is running on: http://localhost:${PORT}
  `);
}

bootstrap();
