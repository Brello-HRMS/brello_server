import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationService } from './services/organization.service';
import { OrganizationController } from './controllers/organization.controller';
import { Organization } from './entities/organization.entity';
import { OrganizationRepository } from './repositories/organization.repository';
import { EnterpriseModule } from '../enterprise/enterprise.module';
import { OrganizationProfile } from './entities/organization-profile.entity';
import { OrganizationProfileRepository } from './repositories/organization-profile.repository';
import { OrganizationProfileService } from './services/organization-profile.service';
import { OrganizationProfileController } from './controllers/organization-profile.controller';
import { DocumentModule } from '../document/document.module';
import { IndustryTypeModule } from '../industry-type/industry-type.module';
import { UserRepository } from '../user/repositories/user.repository';
import { User } from '../user/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { PlanModule } from '../plan/plan.module';
import { PayrollComponent } from '../payroll/entities/payroll-component.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      OrganizationProfile,
      User,
      PayrollComponent,
    ]),
    EnterpriseModule,
    forwardRef(() => DocumentModule),
    IndustryTypeModule,
    forwardRef(() => AuthModule),
    forwardRef(() => PlanModule),
  ],
  controllers: [OrganizationController, OrganizationProfileController],
  providers: [
    OrganizationService,
    OrganizationRepository,
    OrganizationProfileService,
    OrganizationProfileRepository,
    UserRepository,
  ],
  exports: [OrganizationService, OrganizationProfileService],
})
export class OrganizationModule {}
