import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../departments/entities/department.entity';
import { Designation } from '../designations/entities/designation.entity';
import { LetterCategory } from '../hr-template/entities/letter-category.entity';
import { LetterTemplate } from '../hr-template/entities/letter-template.entity';
import { PlatformDepartmentService } from './services/platform-department.service';
import { PlatformDesignationService } from './services/platform-designation.service';
import { PlatformLetterCategoryService } from './services/platform-letter-category.service';
import { PlatformLetterTemplateService } from './services/platform-letter-template.service';
import { PlatformDepartmentController } from './controllers/platform-department.controller';
import { PlatformDesignationController } from './controllers/platform-designation.controller';
import { PlatformLetterCategoryController } from './controllers/platform-letter-category.controller';
import { PlatformLetterTemplateController } from './controllers/platform-letter-template.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Department, Designation, LetterCategory, LetterTemplate])],
  controllers: [
    PlatformDepartmentController,
    PlatformDesignationController,
    PlatformLetterCategoryController,
    PlatformLetterTemplateController,
  ],
  providers: [
    PlatformDepartmentService,
    PlatformDesignationService,
    PlatformLetterCategoryService,
    PlatformLetterTemplateService,
  ],
  exports: [
    PlatformDepartmentService,
    PlatformDesignationService,
    PlatformLetterCategoryService,
    PlatformLetterTemplateService,
  ],
})
export class PlatformModule {}
