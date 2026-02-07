import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationService } from './services/organization.service';
import { OrganizationController } from './controllers/organization.controller';
import { Organization } from './entities/organization.entity';
import { OrganizationRepository } from './repositories/organization.repository';
import { EnterpriseModule } from '../enterprise/enterprise.module';

/**
 * Organization Module
 * 
 * Encapsulates all organization-related functionality.
 * Follows the Module pattern for organizing related components.
 * 
 * Design Pattern: Module Pattern
 * - Groups related components together
 * - Provides clear boundaries and dependencies
 * - Imports EnterpriseModule for validation
 * 
 * Exports:
 * - OrganizationService: For use in other modules (e.g., User module)
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([Organization]),
        EnterpriseModule, // Import to access EnterpriseService for validation
    ],
    controllers: [OrganizationController],
    providers: [OrganizationService, OrganizationRepository],
    exports: [OrganizationService], // Export for use in other modules
})
export class OrganizationModule { }
