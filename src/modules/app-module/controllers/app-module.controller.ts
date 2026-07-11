import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AppModuleService } from '../services/app-module.service';
import {
  CreateAppModuleDto,
  UpdateAppModuleDto,
  ReorderAppModulesDto,
} from '../dto/app-module.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('app-modules')
@UseGuards(JwtAuthGuard, AccessGuard)
export class AppModuleController {
  constructor(private readonly appModuleService: AppModuleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ACCESS_PERMISSIONS', 'create')
  create(
    @Body() createAppModuleDto: CreateAppModuleDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appModuleService.create(createAppModuleDto, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'view')
  findAll(
    @Query('app_id') appId: string | undefined,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appModuleService.findAll(user, appId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'view')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appModuleService.findOne(id, user);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'edit')
  reorder(
    @Body() reorderDto: ReorderAppModulesDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appModuleService.reorder(reorderDto, user);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'edit')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAppModuleDto: UpdateAppModuleDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appModuleService.update(id, updateAppModuleDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ACCESS_PERMISSIONS', 'delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appModuleService.remove(id, user);
  }
}
