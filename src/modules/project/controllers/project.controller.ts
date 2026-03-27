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
  UploadedFile,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectService } from '../services/project.service';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { ListProjectsDto } from '../dto/list-projects.dto';
import { AssignTeamDto } from '../dto/assign-team.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @Query() query: ListProjectsDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.findAll(query, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.findOne(id, user);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.update(id, updateProjectDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.remove(id, user);
  }

  @Post(':id/team')
  @HttpCode(HttpStatus.OK)
  assignTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTeamDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.assignTeam(id, dto, user);
  }

  @Post(':id/contract')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  uploadContract(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: any,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.uploadContract(id, file, user);
  }

  @Get(':id/team')
  @HttpCode(HttpStatus.OK)
  getTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.getTeam(id, user);
  }

  @Get(':id/contracts')
  @HttpCode(HttpStatus.OK)
  getContracts(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.getContracts(id, user);
  }

  @Delete(':id/team/:userId')
  @HttpCode(HttpStatus.OK)
  removeTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.projectService.removeTeamMember(id, userId, user);
  }
}
