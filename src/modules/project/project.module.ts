import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectContract } from './entities/project-contract.entity';
import { ProjectTeam } from './entities/project-team.entity';
import { ProjectRepository } from './repositories/project.repository';
import { ProjectService } from './services/project.service';
import { ProjectController } from './controllers/project.controller';
import { ClientProjectController } from './controllers/client-project.controller';
import { ClientModule } from '../client/client.module';
import { GlobalSearchModule } from '../global-search/global-search.module';
import { UserModule } from '../user/user.module';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectContract, ProjectTeam]),
    forwardRef(() => ClientModule),
    UserModule,
    DocumentModule,
    GlobalSearchModule,
  ],
  controllers: [ProjectController, ClientProjectController],
  providers: [ProjectService, ProjectRepository],
  exports: [ProjectService, ProjectRepository, TypeOrmModule],
})
export class ProjectModule {}
