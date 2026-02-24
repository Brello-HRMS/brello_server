import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as fs from 'fs';

/**
 * Database Configuration Factory
 *
 * Creates TypeORM configuration from YAML properties (via ConfigService).
 * All DB values are read from `db.postgres.*` keys in dev.properties.yaml.
 *
 * Design Pattern: Factory Pattern
 * - Creates configuration object based on properties
 *
 * Features:
 * - Automatic entity discovery
 * - SSL support for cloud-hosted databases
 * - Synchronization in development (disabled in production)
 * - Logging for debugging
 */
export const databaseConfigFactory = (
    config: ConfigService,
): TypeOrmModuleOptions => {
    const sslCaPath = config.get<string>('db.postgres.DB_SSL_CA');

    return {
        type: 'postgres',
        host: config.get<string>('db.postgres.HOST', 'localhost'),
        port: config.get<number>('db.postgres.PORT', 5432),
        username: config.get<string>('db.postgres.DB_USER', 'postgres'),
        password: config.get<string>('db.postgres.DB_PASSWORD'),
        database: config.get<string>('db.postgres.DB_NAME', 'brello'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        schema: config.get<string>('db.postgres.DB_SCHEMA', 'brello'),

        // Auto-sync schema in development only
        // WARNING: Never use synchronize: true in production
        synchronize: config.get<string>('brello.environment') === 'dev',

        // Enable logging in development for debugging (only errors, warnings, and schema changes)
        logging: config.get<string>('brello.environment') === 'dev'
            ? ['error', 'warn', 'schema', 'migration']
            : false,

        // SSL configuration for cloud-hosted databases (e.g., Aiven)
        ...(sslCaPath && {
            ssl: {
                ca: fs.readFileSync(sslCaPath).toString(),
            },
        }),

        // Connection pool settings for better performance
        extra: {
            max: 10, // Maximum number of connections
            idleTimeoutMillis: 30000, // Close idle connections after 30s
        },
    };
};
