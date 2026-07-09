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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AppService } from '../services/app.service';
import { CreateAppDto } from '../dto/create-app.dto';
import { UpdateAppDto } from '../dto/update-app.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('apps')
@UseGuards(JwtAuthGuard, AccessGuard, PlatformAdminGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  @RequirePermission('APP', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateAppDto,
  ) {
    return this.appService.create(user, dto);
  }

  @Get()
  @RequirePermission('APP', 'view')
  @HttpCode(HttpStatus.OK)
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.appService.findAllForUser(user);
  }

  @Get(':id')
  @RequirePermission('APP', 'view')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appService.findOneForUser(id, user);
  }

  @Patch(':id')
  @RequirePermission('APP', 'update')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: UpdateAppDto,
  ) {
    return this.appService.update(id, user, dto);
  }

  @Delete(':id')
  @RequirePermission('APP', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appService.remove(id, user);
  }
}
