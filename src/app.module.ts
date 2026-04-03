import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfigFactory } from './config/database.config';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepartmentModule } from './modules/departments/department.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { PlanModule } from './modules/plan/plan.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AppManagementModule } from './modules/app/app-management.module';
import { AppModuleModule } from './modules/app-module/app-module.module';
import { PropertiesModule } from './core/properties/properties.module';
import { IndustryTypeModule } from './modules/industry-type/industry-type.module';
import { DocumentModule } from './modules/document/document.module';
import { LeadModule } from './modules/lead/lead.module';
import { RoleModule } from './modules/role/role.module';
import { ClientModule } from './modules/client/client.module';
import { ProjectModule } from './modules/project/project.module';
import { CompanyPolicyModule } from './modules/company-policy/company-policy.module';
import { DesignationModule } from './modules/designations/designation.module';
import { HolidayModule } from './modules/holiday/holiday.module';
import { AttendanceModule } from './modules/attendance/attendance.module';

import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggedInUserInterceptor } from './common/interceptors/logged-in-user.interceptor';

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

    // Feature modules — loaded in dependency order
    // (EnterpriseModule first because OrganizationModule depends on it)
    EnterpriseModule,
    OrganizationModule,
    UserModule,
    AuthModule,
    DepartmentModule,
    DocumentModule,
    IndustryTypeModule,
    // New RBAC + multi-app modules
    AppManagementModule,
    PlanModule,
    AppModuleModule,
    RbacModule,
    NotificationModule,
    LeadModule,
    RoleModule,
    ClientModule,
    ProjectModule,
    CompanyPolicyModule,
    DesignationModule,
    HolidayModule,
    AttendanceModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggedInUserInterceptor,
    },
  ],
})
export class AppModule {}
