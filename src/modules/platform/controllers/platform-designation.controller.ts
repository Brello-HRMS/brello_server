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
import { PlatformDesignationService } from '../services/platform-designation.service';
import { CreatePlatformDesignationDto } from '../dto/create-platform-designation.dto';
import { UpdatePlatformDesignationDto } from '../dto/update-platform-designation.dto';

@Controller('platform-admin/designations')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformDesignationController {
  constructor(private readonly platformDesignationService: PlatformDesignationService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.platformDesignationService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createDesignationDto: CreatePlatformDesignationDto) {
    return this.platformDesignationService.create(createDesignationDto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDesignationDto: UpdatePlatformDesignationDto,
  ) {
    return this.platformDesignationService.update(id, updateDesignationDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformDesignationService.remove(id);
  }
}
