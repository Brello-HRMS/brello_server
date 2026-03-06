import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
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
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createRoleDto: CreateRoleDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.roleService.create(createRoleDto, currentUser);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.roleService.findAll();
  }

  @Get('filter')
  @HttpCode(HttpStatus.OK)
  findByFilter(
    @Query('organization_id', ParseUUIDPipe) organizationId: string,
    @Query('enterprise_id', ParseUUIDPipe) enterpriseId: string,
  ) {
    return this.roleService.findByFilter(organizationId, enterpriseId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roleService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.roleService.update(id, updateRoleDto, currentUser);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.roleService.remove(id, currentUser);
  }
}
