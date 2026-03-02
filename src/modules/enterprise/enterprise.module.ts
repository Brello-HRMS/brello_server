import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnterpriseService } from './services/enterprise.service';
import { EnterpriseController } from './controllers/enterprise.controller';
import { Enterprise } from './entities/enterprise.entity';
import { EnterpriseApp } from './entities/enterprise-app.entity';
import { EnterpriseRepository } from './repositories/enterprise.repository';
import { EnterpriseAppRepository } from './repositories/enterprise-app.repository';

/**
 * Enterprise Module
 *
 * Encapsulates all enterprise-related functionality.
 * Follows the Module pattern for organizing related components.
 *
 * Design Pattern: Module Pattern
 * - Groups related components together
 * - Provides clear boundaries and dependencies
 * - Enables lazy loading and code splitting
 *
 * Exports:
 * - EnterpriseService: For use in other modules (e.g., Organization module)
 */
@Module({
  imports: [TypeOrmModule.forFeature([Enterprise, EnterpriseApp])],
  controllers: [EnterpriseController],
  providers: [EnterpriseService, EnterpriseRepository, EnterpriseAppRepository],
  exports: [EnterpriseService, EnterpriseAppRepository], // Export for use in other modules
})
export class EnterpriseModule {}
