import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
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
 * Imports:
 *  - EnterpriseModule, OrganizationModule, UserModule (existing)
 *  - AuthModule (updated for multi-app JWT)
 *  - RbacModule (PermissionResolver, roles, module-access, menu API)
 *  - PlanModule (plan definitions and subscription management)
 *  - AppManagementModule (multi-app registry)
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),

    // Existing modules
    EnterpriseModule,
    OrganizationModule,
    UserModule,
    AuthModule,

    // New RBAC + multi-app modules
    AppManagementModule,
    PlanModule,
    PropertiesModule,
    RbacModule,
  ],
})
export class AppModule { }
