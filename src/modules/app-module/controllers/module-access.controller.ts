import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ModuleAccessService } from '../services/module-access.service';
import {
  CreateModuleAccessDto,
  UpdateModuleAccessDto,
} from '../dto/module-access.dto';

@Controller('module-access')
export class ModuleAccessController {
  constructor(private readonly moduleAccessService: ModuleAccessService) {}

  @Post()
  create(@Body() createModuleAccessDto: CreateModuleAccessDto) {
    return this.moduleAccessService.create(createModuleAccessDto);
  }

  @Get()
  findAll() {
    return this.moduleAccessService.findAll();
  }

  @Get('role/:roleId')
  findByRole(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.moduleAccessService.findByRole(roleId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.moduleAccessService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateModuleAccessDto: UpdateModuleAccessDto,
  ) {
    return this.moduleAccessService.update(id, updateModuleAccessDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.moduleAccessService.remove(id);
  }
}
