import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimesheetEntry } from './entities/timesheet-entry.entity';
import { TimesheetRepository } from './repositories/timesheet.repository';
import { TimesheetService } from './services/timesheet.service';
import { TimesheetController } from './controllers/timesheet.controller';
import { ProjectTeam } from '../project/entities/project-team.entity';
import { Project } from '../project/entities/project.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimesheetEntry, ProjectTeam, Project]),
    RbacModule,
  ],
  controllers: [TimesheetController],
  providers: [TimesheetService, TimesheetRepository],
  exports: [TimesheetService],
})
export class TimesheetModule {}
