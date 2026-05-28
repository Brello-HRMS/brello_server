import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';
import { PlatformDepartmentService } from '../services/platform-department.service';
import { CreatePlatformDepartmentDto } from '../dto/create-platform-department.dto';
import { UpdatePlatformDepartmentDto } from '../dto/update-platform-department.dto';

@Controller('platform-admin/departments')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformDepartmentController {
  constructor(private readonly platformDepartmentService: PlatformDepartmentService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.platformDepartmentService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createDepartmentDto: CreatePlatformDepartmentDto) {
    return this.platformDepartmentService.create(createDepartmentDto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDepartmentDto: UpdatePlatformDepartmentDto,
  ) {
    return this.platformDepartmentService.update(id, updateDepartmentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformDepartmentService.remove(id);
  }
}
