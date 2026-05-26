import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  
  const result = await dataSource.query(`
    SELECT conname, conrelid::regclass AS table_name, a.attname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE conname = 'UQ_8b0da8d2b4e31f4678e71976aa6';
  `);
  
  console.log('Constraint Info:', JSON.stringify(result, null, 2));
  await app.close();
}

bootstrap();
