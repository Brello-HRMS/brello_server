import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Designation } from './entities/designation.entity';
import { DesignationRepository } from './repositories/designation.repository';
import { DesignationService } from './services/designation.service';
import { DesignationController } from './controllers/designation.controller';
import { OrganizationModule } from '../organization/organization.module';
import { GlobalSearchModule } from '../global-search/global-search.module';

/**
 * Designation Module
 *
 * Encapsulates all designation-related functionality.
 *
 * Dependencies:
 * - TypeOrmModule registers the Designation entity with the DB connection.
 * - OrganizationModule is imported to access OrganizationService
 *   for validating that the target org exists.
 *
 * Exports:
 * - DesignationService: available for injection in other modules (e.g., Employee module).
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([Designation]),
        OrganizationModule,
        GlobalSearchModule, // Provides OrganizationService for cross-module validation
    ],
    controllers: [DesignationController],
    providers: [DesignationService, DesignationRepository],
    exports: [DesignationService],
})
export class DesignationModule { }
