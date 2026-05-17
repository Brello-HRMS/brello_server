import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { LeaveConfigService } from '../services/leave-config.service';
import { CreateLeaveConfigDto } from '../dto/create-leave-config.dto';
import { UpdateLeaveConfigDto } from '../dto/update-leave-config.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('leave-configs')
@UseGuards(JwtAuthGuard, AccessGuard)
export class LeaveConfigController {
  constructor(private readonly leaveConfigService: LeaveConfigService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ORG_LEAVE', 'create')
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateLeaveConfigDto,
  ) {
    return this.leaveConfigService.createDraft(user, dto);
  }

  @Get('current')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ORG_LEAVE', 'view')
  findCurrent(@LoggedInUser() user: LoggedInUserInterface) {
    return this.leaveConfigService.findCurrent(user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ORG_LEAVE', 'view')
  findOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaveConfigService.findOne(user, id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ORG_LEAVE', 'update')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveConfigDto,
  ) {
    return this.leaveConfigService.updateConfig(user, id, dto);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ORG_LEAVE', 'activate')
  activate(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaveConfigService.activateConfig(user, id);
  }
}
