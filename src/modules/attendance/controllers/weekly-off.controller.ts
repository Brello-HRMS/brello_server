import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { WeeklyOffService } from '../services/weekly-off.service';
import { CreateWeeklyOffDto } from '../dto/create-weekly-off.dto';
import { UpdateWeeklyOffDto } from '../dto/update-weekly-off.dto';
import { ChangeStatusDto } from '../dto/change-status.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('attendance/weekly-offs')
@UseGuards(JwtAuthGuard, AccessGuard)
export class WeeklyOffController {
  constructor(private readonly weeklyOffService: WeeklyOffService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ATTENDANCE_CONFIG', 'create')
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateWeeklyOffDto,
  ) {
    return this.weeklyOffService.create(user, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE_CONFIG', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() pagination: PaginationDto,
  ) {
    return this.weeklyOffService.findAll(user, pagination);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE_CONFIG', 'update')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWeeklyOffDto,
  ) {
    return this.weeklyOffService.update(user, id, dto);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ATTENDANCE_CONFIG', 'activate')
  changeStatus(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.weeklyOffService.changeStatus(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ATTENDANCE_CONFIG', 'delete')
  delete(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.weeklyOffService.delete(user, id);
  }
}
