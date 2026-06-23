import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UserRoleMapService } from '../services/user-role-map.service';
import { CreateUserRoleMapDto } from '../dto/create-user-role-map.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { ListUserRoleMapsDto } from '../dto/list-user-role-maps.dto';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('user-role-maps')
@UseGuards(JwtAuthGuard, AccessGuard)
export class UserRoleMapController {
  constructor(private readonly userRoleMapService: UserRoleMapService) {}

  @AuditLog(AuditLogModule.USER_ROLE, AuditAction.ASSIGN, 'user_role')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ACCESS_USERS', 'create')
  create(@Body() dto: CreateUserRoleMapDto) {
    return this.userRoleMapService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_USERS', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListUserRoleMapsDto,
  ) {
    return this.userRoleMapService.findAll(user, query);
  }

  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_USERS', 'view')
  findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.userRoleMapService.findByUserId(userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_USERS', 'view')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userRoleMapService.findOne(id);
  }

  @AuditLog(AuditLogModule.USER_ROLE, AuditAction.REVOKE, 'user_role')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ACCESS_USERS', 'delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userRoleMapService.remove(id);
  }
}
