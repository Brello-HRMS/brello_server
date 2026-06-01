import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LetterCategory } from './entities/letter-category.entity';
import { LetterTemplate } from './entities/letter-template.entity';
import { LetterCategoryRepository } from './repositories/letter-category.repository';
import { LetterTemplateRepository } from './repositories/letter-template.repository';
import { LetterCategoryService } from './services/letter-category.service';
import { LetterTemplateService } from './services/letter-template.service';
import { LetterCategoryController } from './controllers/letter-category.controller';
import { LetterTemplateController } from './controllers/letter-template.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LetterCategory, LetterTemplate])],
  controllers: [LetterCategoryController, LetterTemplateController],
  providers: [
    LetterCategoryRepository,
    LetterTemplateRepository,
    LetterCategoryService,
    LetterTemplateService,
  ],
  exports: [LetterCategoryService, LetterTemplateService],
})
export class HrTemplateModule {}
