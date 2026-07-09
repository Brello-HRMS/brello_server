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
import { PlanService } from '../services/plan.service';
import { CreatePlanDto, UpdatePlanDto } from '../dto/plan.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @AuditLog(AuditLogModule.PLATFORM_PLAN, AuditAction.CREATE, 'plan')
  @Post()
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createPlanDto: CreatePlanDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planService.create(createPlanDto, user);
  }

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query('enterprise_id') enterpriseId?: string,
  ) {
    return this.planService.findAll(user, enterpriseId ? { enterprise_id: enterpriseId } : undefined);
  }

  @Get(':id')
  @Public()
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planService.findOne(id, user);
  }

  @AuditLog(AuditLogModule.PLATFORM_PLAN, AuditAction.UPDATE, 'plan')
  @Patch(':id')
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlanDto: UpdatePlanDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planService.update(id, updatePlanDto, user);
  }

  @AuditLog(AuditLogModule.PLATFORM_PLAN, AuditAction.DELETE, 'plan')
  @Delete(':id')
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planService.remove(id, user);
  }

  @Get(':id/apps')
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  getApps(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planService.getAppsForPlan(id, user);
  }

  @AuditLog(AuditLogModule.PLATFORM_PLAN, AuditAction.ASSIGN, 'plan_app')
  @Post(':id/apps')
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  assignApps(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('appIds') appIds: string[],
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.planService.assignAppsToPlan(id, appIds, user);
  }
}
