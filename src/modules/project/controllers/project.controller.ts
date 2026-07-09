import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ProjectService } from '../services/project.service';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { ListProjectsDto } from '../dto/list-projects.dto';
import { AssignTeamDto } from '../dto/assign-team.dto';
import { UploadContractDto } from '../dto/upload-contract.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('projects')
@UseGuards(JwtAuthGuard, AccessGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @RequirePermission('PROJECTS', 'view')
  @HttpCode(HttpStatus.OK)
  findAll(
    @Query() query: ListProjectsDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('PROJECTS', 'view')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.findOne(id, user);
  }

  @AuditLog(AuditLogModule.PROJECT, AuditAction.UPDATE, 'project')
  @Put(':id')
  @RequirePermission('PROJECTS', 'update')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.update(id, updateProjectDto, user);
  }

  @AuditLog(AuditLogModule.PROJECT, AuditAction.DELETE, 'project')
  @Delete(':id')
  @RequirePermission('PROJECTS', 'delete')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.remove(id, user);
  }

  @AuditLog(AuditLogModule.PROJECT, AuditAction.ASSIGN, 'project_team_member')
  @Post(':id/team')
  @RequirePermission('PROJECTS', 'create')
  @HttpCode(HttpStatus.OK)
  assignTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTeamDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.assignTeam(id, dto, user);
  }

  @Post(':id/contract')
  @RequirePermission('PROJECTS', 'create')
  @HttpCode(HttpStatus.CREATED)
  uploadContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadContractDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.uploadContract(id, dto, user);
  }

  @Get(':id/team')
  @RequirePermission('PROJECTS', 'view')
  @HttpCode(HttpStatus.OK)
  getTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.getTeam(id, user);
  }

  @Get(':id/contracts')
  @RequirePermission('PROJECTS', 'view')
  @HttpCode(HttpStatus.OK)
  getContracts(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.getContracts(id, user);
  }

  @AuditLog(AuditLogModule.PROJECT, AuditAction.UNASSIGN, 'project_team_member', { entityIdParam: 'userId' })
  @Delete(':id/team/:userId')
  @RequirePermission('PROJECTS', 'delete')
  @HttpCode(HttpStatus.OK)
  removeTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.removeTeamMember(id, userId, user);
  }

  @Delete(':id/contracts/:contractId')
  @RequirePermission('PROJECTS', 'delete')
  @HttpCode(HttpStatus.OK)
  removeContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.removeContract(id, contractId, user);
  }
}
