import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyPolicyType } from './entities/company-policy-type.entity';
import { CompanyPolicy } from './entities/company-policy.entity';
import { CompanyPolicyTypeRepository } from './repositories/company-policy-type.repository';
import { CompanyPolicyRepository } from './repositories/company-policy.repository';
import { CompanyPolicyTypeService } from './services/company-policy-type.service';
import { CompanyPolicyService } from './services/company-policy.service';
import { CompanyPolicyTypeController } from './controllers/company-policy-type.controller';
import { CompanyPolicyController } from './controllers/company-policy.controller';
import { RbacModule } from '../rbac/rbac.module';
import { GlobalSearchModule } from '../global-search/global-search.module';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            CompanyPolicyType,
            CompanyPolicy,
        ]),
        RbacModule,
        GlobalSearchModule,
        UserModule,
        NotificationModule,
    ],
    controllers: [
        CompanyPolicyTypeController,
        CompanyPolicyController,
    ],
    providers: [
        CompanyPolicyTypeRepository,
        CompanyPolicyRepository,
        CompanyPolicyTypeService,
        CompanyPolicyService,
    ],
    exports: [
        CompanyPolicyTypeService,
        CompanyPolicyService,
    ],
})
export class CompanyPolicyModule { }
