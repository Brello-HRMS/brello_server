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
import { AppModuleService } from '../services/app-module.service';
import { CreateAppModuleDto, UpdateAppModuleDto } from '../dto/app-module.dto';

@Controller('modules')
export class AppModuleController {
  constructor(private readonly appModuleService: AppModuleService) {}

  @Post()
  create(@Body() createAppModuleDto: CreateAppModuleDto) {
    return this.appModuleService.create(createAppModuleDto);
  }

  @Get()
  findAll() {
    return this.appModuleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.appModuleService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAppModuleDto: UpdateAppModuleDto,
  ) {
    return this.appModuleService.update(id, updateAppModuleDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.appModuleService.remove(id);
  }
}
