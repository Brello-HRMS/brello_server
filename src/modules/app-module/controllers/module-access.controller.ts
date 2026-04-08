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
import { ModuleAccessService } from '../services/module-access.service';
import {
  CreateModuleAccessDto,
  UpdateModuleAccessDto,
  AssignModuleAccessByCodeDto,
} from '../dto/module-access.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('module-access')
@UseGuards(JwtAuthGuard)
export class ModuleAccessController {
  constructor(private readonly moduleAccessService: ModuleAccessService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createModuleAccessDto: CreateModuleAccessDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.create(createModuleAccessDto, user);
  }

  @Post('by-code')
  @HttpCode(HttpStatus.CREATED)
  assignByCode(
    @Body() dto: AssignModuleAccessByCodeDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.assignByCode(dto, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.moduleAccessService.findAll(user);
  }

  @Get('role/:roleId')
  @HttpCode(HttpStatus.OK)
  findByRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.findByRole(roleId, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.findOne(id, user);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateModuleAccessDto: UpdateModuleAccessDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.update(id, updateModuleAccessDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.moduleAccessService.remove(id, user);
  }
}
