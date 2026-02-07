import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { EnterpriseModule } from '../enterprise/enterprise.module';
import { OrganizationModule } from '../organization/organization.module';

/**
 * User Module
 * 
 * Encapsulates all user-related functionality.
 * Follows the Module pattern for organizing related components.
 * 
 * Design Pattern: Module Pattern
 * - Groups related components together
 * - Provides clear boundaries and dependencies
 * - Imports Enterprise and Organization modules for validation
 * 
 * Exports:
 * - UserService: For use in Auth module
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        EnterpriseModule, // Import for enterprise validation
        OrganizationModule, // Import for organization validation
    ],
    controllers: [UserController],
    providers: [UserService, UserRepository],
    exports: [UserService], // Export for use in Auth module
})
export class UserModule { }
