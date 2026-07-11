import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LetterTemplate } from './entities/letter-template.entity';
import { LetterTemplateRepository } from './repositories/letter-template.repository';
import { LetterTemplateService } from './services/letter-template.service';
import { LetterTemplateController } from './controllers/letter-template.controller';
import { LetterCategoriesModule } from '../categories/letter-categories.module';
import { SignatoriesModule } from '../signatories/signatories.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LetterTemplate]),
    LetterCategoriesModule,
    SignatoriesModule,
    RbacModule,
  ],
  controllers: [LetterTemplateController],
  providers: [LetterTemplateRepository, LetterTemplateService],
  exports: [LetterTemplateService, LetterTemplateRepository],
})
export class LetterTemplatesModule {}
