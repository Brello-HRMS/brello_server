import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndustryType } from './entities/industry-type.entity';
import { IndustryTypeController } from './controllers/industry-type.controller';
import { IndustryTypeService } from './services/industry-type.service';
import { IndustryTypeRepository } from './repositories/industry-type.repository';

@Module({
  imports: [TypeOrmModule.forFeature([IndustryType])],
  controllers: [IndustryTypeController],
  providers: [IndustryTypeService, IndustryTypeRepository],
  exports: [IndustryTypeService],
})
export class IndustryTypeModule {}
