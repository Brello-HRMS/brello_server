import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

export class PostgresConfiguration implements TypeOrmOptionsFactory {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  createTypeOrmOptions(
    connectionName?: string,
  ): Promise<TypeOrmModuleOptions> | TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.config.get('db.postgres.HOST'),
      port: this.config.get('db.postgres.PORT'),
      username: this.config.get('db.postgres.DB_USER'),
      password: this.config.get('db.postgres.DB_PASSWORD'),
      database: this.config.get('db.postgres.DB_NAME'),
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      migrations: ['./dist/migrations/*.{ts,js}'],
      migrationsTableName: 'typeorm_migrations',
      synchronize: this.config.get('DB_SYNC'),
      logger: 'file',
    };
  }
}
