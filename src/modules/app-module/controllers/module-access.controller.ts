import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ModuleAccessService } from '../services/module-access.service';
import {
  CreateModuleAccessDto,
  UpdateModuleAccessDto,
  AssignModuleAccessByCodeDto,
  UpdateRolePermissionsListDto,
} from '../dto/module-access.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('module-access')
@UseGuards(JwtAuthGuard, AccessGuard)
export class ModuleAccessController {
  constructor(private readonly moduleAccessService: ModuleAccessService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ACCESS_PERMISSIONS', 'create')
  create(
    @Body() createModuleAccessDto: CreateModuleAccessDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.create(createModuleAccessDto, user);
  }

  @Post('by-code')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ACCESS_PERMISSIONS', 'create')
  assignByCode(
    @Body() dto: AssignModuleAccessByCodeDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.assignByCode(dto, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'view')
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.moduleAccessService.findAll(user);
  }

  @Get('role/:roleId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'view')
  findByRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.findByRole(roleId, user);
  }

  @Get('role/:roleId/permissions-list')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'view')
  getPermissionsList(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.getPermissionsList(roleId, user);
  }

  @Put('role/:roleId/permissions-list')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'edit')
  updatePermissionsList(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRolePermissionsListDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.updatePermissionsList(roleId, dto, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'view')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.findOne(id, user);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'edit')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateModuleAccessDto: UpdateModuleAccessDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.update(id, updateModuleAccessDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ACCESS_PERMISSIONS', 'delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.remove(id, user);
  }
}
