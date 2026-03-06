import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DesignationModule } from './modules/designations/designation.module';

/**
 * App Module
 * 
 * Root module of the application.
 * Imports all feature modules and configures global services.
 * 
 * Design Pattern: Module Pattern
 * - Organizes application into cohesive modules
 * - Provides dependency injection container
 * - Configures global providers
 * 
 * Configuration:
 * - Environment variables via ConfigModule
 * - Database connection via TypeOrmModule
 * - Feature modules: Enterprise, Organization, User, Auth
 */
@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigService available globally
      load: [databaseConfig],
      envFilePath: '.env',
    }),

    // Configure TypeORM with database config
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),

    // Feature modules
    EnterpriseModule,
    OrganizationModule,
    UserModule,
    AuthModule,
    DesignationModule,
  ],
})
export class AppModule { }

