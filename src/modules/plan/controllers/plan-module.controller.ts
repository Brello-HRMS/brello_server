import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { AccessGuard } from '../../../core/guards/access.guard';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlanModuleService } from '../services/plan-module.service';
import {
  CreatePlanModuleDto,
  UpdatePlanModuleDto,
} from '../dto/plan-module.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('plan-modules')
@UseGuards(JwtAuthGuard, AccessGuard, PlatformAdminGuard)
export class PlanModuleController {
  constructor(private readonly planModuleService: PlanModuleService) {}

  @Post()
  @RequirePermission('PLAN', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createPlanModuleDto: CreatePlanModuleDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planModuleService.create(createPlanModuleDto, user);
  }

  @Get()
  @RequirePermission('PLAN', 'view')
  @HttpCode(HttpStatus.OK)
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.planModuleService.findAll(user);
  }

  @Get('plan/:planId')
  @RequirePermission('PLAN', 'view')
  @HttpCode(HttpStatus.OK)
  findByPlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planModuleService.findByPlan(planId, user);
  }

  @Get(':id')
  @RequirePermission('PLAN', 'view')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planModuleService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermission('PLAN', 'update')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlanModuleDto: UpdatePlanModuleDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planModuleService.update(id, updatePlanModuleDto, user);
  }

  @Delete(':id')
  @RequirePermission('PLAN', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planModuleService.remove(id, user);
  }
}
