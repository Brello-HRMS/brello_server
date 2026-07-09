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
import { PlanModuleActionService } from '../services/plan-module-action.service';
import {
  CreatePlanModuleActionDto,
  UpdatePlanModuleActionDto,
} from '../dto/plan-module-action.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('plan-module-actions')
@UseGuards(JwtAuthGuard, AccessGuard, PlatformAdminGuard)
export class PlanModuleActionController {
  constructor(
    private readonly planModuleActionService: PlanModuleActionService,
  ) {}

  @Post()
  @RequirePermission('PLAN', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createPlanModuleActionDto: CreatePlanModuleActionDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planModuleActionService.create(createPlanModuleActionDto, user);
  }

  @Get()
  @RequirePermission('PLAN', 'view')
  @HttpCode(HttpStatus.OK)
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.planModuleActionService.findAll(user);
  }

  @Get('plan/:planId')
  @RequirePermission('PLAN', 'view')
  @HttpCode(HttpStatus.OK)
  findByPlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planModuleActionService.findByPlan(planId, user);
  }

  @Get('plan/:planId/module/:moduleId')
  @RequirePermission('PLAN', 'view')
  @HttpCode(HttpStatus.OK)
  findByPlanAndModule(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planModuleActionService.findByPlanAndModule(planId, moduleId, user);
  }

  @Get(':id')
  @RequirePermission('PLAN', 'view')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planModuleActionService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermission('PLAN', 'update')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlanModuleActionDto: UpdatePlanModuleActionDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planModuleActionService.update(id, updatePlanModuleActionDto, user);
  }

  @Delete(':id')
  @RequirePermission('PLAN', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planModuleActionService.remove(id, user);
  }
}
