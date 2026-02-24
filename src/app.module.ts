import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfigFactory } from './config/database.config';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { PlanModule } from './modules/plan/plan.module';
import { AppManagementModule } from './modules/app/app-management.module';
import { PropertiesModule } from './core/properties/properties.module';

/**
 * App Module — Root module
 *
 * All configuration is loaded from YAML properties files via PropertiesModule.
 * No .env files are used — everything comes from dev.properties.yaml.
 *
 * Imports:
 *  - EnterpriseModule, OrganizationModule, UserModule (existing)
 *  - AuthModule (updated for multi-app JWT)
 *  - RbacModule (PermissionResolver, roles, module-access, menu API)
 *  - PlanModule (plan definitions and subscription management)
 *  - AppManagementModule (multi-app registry)
 */
@Module({
  imports: [
    // Load YAML properties first (makes ConfigService available globally)
    PropertiesModule,

    // TypeORM uses ConfigService to read db.postgres.* from YAML
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: databaseConfigFactory,
    }),

    // Existing modules
    EnterpriseModule,
    OrganizationModule,
    UserModule,
    AuthModule,

    // New RBAC + multi-app modules
    AppManagementModule,
    PlanModule,
    RbacModule,
  ],
})
export class AppModule { }
