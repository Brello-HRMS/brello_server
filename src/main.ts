import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// Bootstrap Application - Initializes and configures the NestJS application
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
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

  // Set global API prefix
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
  🚀 Application is running on: http://localhost:${port}/${apiPrefix}
  `);
}

bootstrap();
