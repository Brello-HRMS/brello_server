import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentService } from './services/department.service';
import { DepartmentController } from './controllers/department.controller';
import { Department } from './entities/department.entity';
import { DepartmentRepository } from './repositories/department.repository';
import { UserModule } from '../user/user.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Department]),
        UserModule,
    ],
    controllers: [DepartmentController],
    providers: [DepartmentService, DepartmentRepository],
    exports: [DepartmentService],
})
export class DepartmentModule { }
