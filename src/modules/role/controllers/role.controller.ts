import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { RoleService } from '../services/role.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { ListRolesDto } from '../dto/list-roles.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('roles')
@UseGuards(JwtAuthGuard, AccessGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @AuditLog(AuditLogModule.ROLE, AuditAction.CREATE, 'role')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ACCESS_ROLES', 'create')
  create(
    @Body() createRoleDto: CreateRoleDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.roleService.create(createRoleDto, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_ROLES', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListRolesDto,
  ) {
    return this.roleService.findAll(user, query);
  }

  @Get('filter')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_ROLES', 'view')
  findByFilter(
    @Query('organization_id', ParseUUIDPipe) organizationId: string,
    @Query('enterprise_id', ParseUUIDPipe) enterpriseId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.roleService.findByFilter(organizationId, enterpriseId, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_ROLES', 'view')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.roleService.findOne(id, user);
  }

  @AuditLog(AuditLogModule.ROLE, AuditAction.UPDATE, 'role')
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_ROLES', 'edit')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.roleService.update(id, updateRoleDto, user);
  }

  @AuditLog(AuditLogModule.ROLE, AuditAction.DELETE, 'role')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ACCESS_ROLES', 'delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.roleService.remove(id, user);
  }
}
