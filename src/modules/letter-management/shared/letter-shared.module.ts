import { Module } from '@nestjs/common';
import { VariableResolverService } from './services/variable-resolver.service';
import { RenderModelBuilderService } from './services/render-model-builder.service';
import { PdfBuilderService } from './services/pdf-builder.service';
import { NumberingService } from './services/numbering.service';
import { VariableRegistryController } from './controllers/variable-registry.controller';
import { UserModule } from '../../user/user.module';
import { PayrollModule } from '../../payroll/payroll.module';
import { OrganizationModule } from '../../organization/organization.module';
import { SignatoriesModule } from '../signatories/signatories.module';
import { LetterSettingsModule } from '../settings/letter-settings.module';

@Module({
  imports: [UserModule, PayrollModule, OrganizationModule, SignatoriesModule, LetterSettingsModule],
  controllers: [VariableRegistryController],
  providers: [
    VariableResolverService,
    RenderModelBuilderService,
    PdfBuilderService,
    NumberingService,
  ],
  exports: [VariableResolverService, RenderModelBuilderService, PdfBuilderService, NumberingService],
})
export class LetterSharedModule {}
