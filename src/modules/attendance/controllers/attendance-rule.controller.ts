import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AttendanceRuleService } from '../services/attendance-rule.service';
import { CreateAttendanceRuleDto } from '../dto/create-attendance-rule.dto';
import { UpdateAttendanceRuleDto } from '../dto/update-attendance-rule.dto';
import { ChangeStatusDto } from '../dto/change-status.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('attendance/rules')
@UseGuards(JwtAuthGuard, AccessGuard)
export class AttendanceRuleController {
  constructor(private readonly ruleService: AttendanceRuleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ATTENDANCE_CONFIG', 'create')
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateAttendanceRuleDto,
  ) {
    return this.ruleService.create(user, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE_CONFIG', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() pagination: PaginationDto,
  ) {
    return this.ruleService.findAll(user, pagination);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE_CONFIG', 'update')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceRuleDto,
  ) {
    return this.ruleService.update(user, id, dto);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE_CONFIG', 'activate')
  changeStatus(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.ruleService.changeStatus(user, id, dto);
  }
}
