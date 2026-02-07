import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Database Configuration
 * 
 * Factory function that creates TypeORM configuration from environment variables.
 * Uses the Factory Pattern to create database configuration dynamically.
 * 
 * Design Pattern: Factory Pattern
 * - Creates configuration object based on environment
 * 
 * Features:
 * - Automatic entity discovery
 * - Synchronization in development (disabled in production)
 * - Logging for debugging
 */
export default registerAs(
    'database',
    (): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE || 'brello',
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        schema: process.env.DB_SCHEMA || 'brello',
        // Auto-sync schema in development only
        // WARNING: Never use synchronize: true in production
        synchronize: process.env.NODE_ENV === 'development',

        // Enable logging in development for debugging
        logging: process.env.NODE_ENV === 'development',

        // Connection pool settings for better performance
        extra: {
            max: 10, // Maximum number of connections
            idleTimeoutMillis: 30000, // Close idle connections after 30s
        },
    }),
);
