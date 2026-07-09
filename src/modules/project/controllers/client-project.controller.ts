import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ProjectService } from '../services/project.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { ListProjectsDto } from '../dto/list-projects.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('clients/:clientId/projects')
@UseGuards(JwtAuthGuard, AccessGuard)
export class ClientProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @AuditLog(AuditLogModule.PROJECT, AuditAction.CREATE, 'project', { entityIdParam: 'clientId' })
  @Post()
  @RequirePermission('PROJECTS', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() createProjectDto: CreateProjectDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.create(clientId, createProjectDto, user);
  }

  @Get()
  @RequirePermission('PROJECTS', 'view')
  @HttpCode(HttpStatus.OK)
  findAll(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() query: ListProjectsDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.findAllByClient(clientId, query, user);
  }
}
