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
import { ActionService } from '../services/action.service';
import { CreateActionDto, UpdateActionDto } from '../dto/action.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('actions')
@UseGuards(JwtAuthGuard, AccessGuard)
export class ActionController {
  constructor(private readonly actionService: ActionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('ACCESS_PERMISSIONS', 'create')
  create(
    @Body() createActionDto: CreateActionDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.actionService.create(createActionDto, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'view')
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.actionService.findAll(user);
  }

  @Get(':id')
  @RequirePermission('ACCESS_PERMISSIONS', 'view')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.actionService.findOne(id, user);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('ACCESS_PERMISSIONS', 'edit')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateActionDto: UpdateActionDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.actionService.update(id, updateActionDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('ACCESS_PERMISSIONS', 'delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.actionService.remove(id, user);
  }
}
