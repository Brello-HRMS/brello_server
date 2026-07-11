import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LetterCategory } from './entities/letter-category.entity';
import { LetterCategoryRepository } from './repositories/letter-category.repository';
import { LetterCategoryService } from './services/letter-category.service';
import { LetterCategoryController } from './controllers/letter-category.controller';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([LetterCategory]), RbacModule],
  controllers: [LetterCategoryController],
  providers: [LetterCategoryRepository, LetterCategoryService],
  exports: [LetterCategoryService, LetterCategoryRepository],
})
export class LetterCategoriesModule {}
