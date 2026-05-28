import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../departments/entities/department.entity';
import { Designation } from '../designations/entities/designation.entity';
import { PlatformDepartmentService } from './services/platform-department.service';
import { PlatformDesignationService } from './services/platform-designation.service';
import { PlatformDepartmentController } from './controllers/platform-department.controller';
import { PlatformDesignationController } from './controllers/platform-designation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Department, Designation])],
  controllers: [PlatformDepartmentController, PlatformDesignationController],
  providers: [PlatformDepartmentService, PlatformDesignationService],
  exports: [PlatformDepartmentService, PlatformDesignationService],
})
export class PlatformModule {}
