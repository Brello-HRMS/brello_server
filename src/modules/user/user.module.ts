import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UserEducation } from './entities/user-education.entity';
import { UserExperience } from './entities/user-experience.entity';
import { UserAssets } from './entities/user-assets.entity';
import { UserGovInfo } from './entities/user-gov-info.entity';
import { UserBankInfo } from './entities/user-bank-info.entity';
import { UserEmergencyPerson } from './entities/user-emergency-person.entity';
import { UserDocument } from './entities/user-document.entity';
import { EmployeeOffboarding } from './entities/offboarding.entity';
import { AuditLog } from './entities/audit-log.entity';

import { UserRepository } from './repositories/user.repository';
import { UserDepartmentRepository } from './repositories/department.repository';
import { UserDesignationRepository } from './repositories/designation.repository';
import { UserProfileRepository } from './repositories/user-profile.repository';
import { UserEducationRepository } from './repositories/user-education.repository';
import { UserExperienceRepository } from './repositories/user-experience.repository';
import { UserAssetsRepository } from './repositories/user-assets.repository';
import { UserGovInfoRepository } from './repositories/user-gov-info.repository';
import { UserBankInfoRepository } from './repositories/user-bank-info.repository';
import { UserEmergencyPersonRepository } from './repositories/user-emergency-person.repository';
import { UserDocumentRepository } from './repositories/user-document.repository';
import { EmployeeOffboardingRepository } from './repositories/offboarding.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';

import { EmployeeService } from './services/employee.service';
import { EmployeeController } from './controllers/employee.controller';
import { OffboardingCronService } from './services/offboarding-cron.service';
import { ScheduleModule } from '@nestjs/schedule';

import { EnterpriseModule } from '../enterprise/enterprise.module';
import { OrganizationModule } from '../organization/organization.module';
import { GlobalSearchModule } from '../global-search/global-search.module';
import { NotificationModule } from '../notification/notification.module';
import { DocumentModule } from '../document/document.module';
import { AuditCoreModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserProfile,
      UserEducation,
      UserExperience,
      UserAssets,
      UserGovInfo,
      UserBankInfo,
      UserEmergencyPerson,
      UserDocument,
      EmployeeOffboarding,
      AuditLog,
    ]),
    ScheduleModule.forRoot(),
    EnterpriseModule,
    forwardRef(() => OrganizationModule),
    GlobalSearchModule,
    DocumentModule,
    NotificationModule,
    AuditCoreModule,
  ],
  controllers: [UserController, EmployeeController],
  providers: [
    UserService,
    UserRepository,
    UserDepartmentRepository,
    UserDesignationRepository,
    EmployeeService,
    OffboardingCronService,
    UserProfileRepository,
    UserEducationRepository,
    UserExperienceRepository,
    UserAssetsRepository,
    UserGovInfoRepository,
    UserBankInfoRepository,
    UserEmergencyPersonRepository,
    UserDocumentRepository,
    EmployeeOffboardingRepository,
    AuditLogRepository,
  ],
  exports: [UserService, EmployeeService, UserRepository, UserDepartmentRepository, UserDesignationRepository],
})
export class UserModule {}
