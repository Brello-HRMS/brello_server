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
import { AppModuleService } from '../services/app-module.service';
import { CreateAppModuleDto, UpdateAppModuleDto } from '../dto/app-module.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('app-modules')
@UseGuards(JwtAuthGuard)
export class AppModuleController {
  constructor(private readonly appModuleService: AppModuleService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createAppModuleDto: CreateAppModuleDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appModuleService.create(createAppModuleDto, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.appModuleService.findAll(user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appModuleService.findOne(id, user);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAppModuleDto: UpdateAppModuleDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appModuleService.update(id, updateAppModuleDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.appModuleService.remove(id, user);
  }
}
