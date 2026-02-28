// NestJS Module decorator — defines this as a NestJS module (the core building block)
import { Module } from '@nestjs/common';

// TypeOrmModule: bridges NestJS DI with TypeORM entity management
// forFeature([Department]) registers the Department entity with TypeORM
// and makes Repository<Department> available for injection via @InjectRepository()
import { TypeOrmModule } from '@nestjs/typeorm';

// The service containing all business logic for departments
import { DepartmentService } from './services/department.service';

// The controller that handles all HTTP routes for /departments
import { DepartmentController } from './controllers/department.controller';

// The Department TypeORM entity — must be registered so TypeORM knows about this table
import { Department } from './entities/department.entity';

// The repository that wraps all raw DB queries for departments
import { DepartmentRepository } from './repositories/department.repository';

// UserModule: imported to access UserService
// WHY DO WE IMPORT UserModule?
// - UserModule exports UserService (see user.module.ts exports array)
// - DepartmentService needs UserService to resolve org_id from userId
// - JWT payload only carries userId — we look up organization_id from the DB
// - Without this import, NestJS DI can't inject UserService into DepartmentService
import { UserModule } from '../user/user.module';

/**
 * DepartmentModule
 *
 * WHY USE MODULES?
 * - Modules are NestJS's unit of encapsulation — like a bounded context
 * - Everything inside this module is self-contained and independently testable
 * - Other modules that need DepartmentService can simply import DepartmentModule
 *   and get access to the exported service (e.g., a future EmployeeModule)
 *
 * MODULE WIRING:
 * - imports: external dependencies this module needs
 * - controllers: HTTP route handlers (bound to @Controller prefix)
 * - providers: services and repositories registered in the DI container
 * - exports: parts of this module shared with other modules that import it
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([Department]),
        // WHY forFeature([Department])?
        // - Registers the Department entity with TypeORM in the scope of THIS module
        // - Makes Repository<Department> injectable via @InjectRepository(Department)
        // - Without this, DepartmentRepository would fail to inject the TypeORM repo

        UserModule,
        // WHY IMPORT UserModule?
        // - UserModule.exports includes UserService
        // - DepartmentService has `private readonly userService: UserService` in its constructor
        // - NestJS DI system needs this import to know WHERE to find UserService
        // - Importing UserModule automatically imports all ITS dependencies too (transitive)
    ],

    controllers: [DepartmentController],
    // WHY REGISTER HERE?
    // - NestJS scans this array → maps routes from @Controller and @Get/@Post etc.
    // - Controller is NOT a provider — don't put it in providers[]
    // - Without this, /departments routes would return 404 (controller not discovered)

    providers: [DepartmentService, DepartmentRepository],
    // WHY BOTH IN providers[]?
    // - providers[] registers classes with NestJS's Dependency Injection container
    // - DepartmentService is injected into DepartmentController
    // - DepartmentRepository is injected into DepartmentService
    // - Order doesn't matter — NestJS resolves the dependency graph automatically

    exports: [DepartmentService],
    // WHY EXPORT DepartmentService?
    // - Future modules (Employee, Reporting, Payroll) may need to look up departments
    // - Exporting means: import DepartmentModule → gain access to DepartmentService
    // - DepartmentRepository is NOT exported — only the service is the public API
    //   (other modules should not bypass business logic and call the repository directly)
})
export class DepartmentModule { }
