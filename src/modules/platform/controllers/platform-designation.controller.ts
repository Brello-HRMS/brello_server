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
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('platform-admin/designations')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformDesignationController {
  constructor(private readonly platformDesignationService: PlatformDesignationService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.platformDesignationService.findAll();
  }

  @AuditLog(AuditLogModule.PLATFORM_SETUP, AuditAction.CREATE, 'platform_designation')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createDesignationDto: CreatePlatformDesignationDto) {
    return this.platformDesignationService.create(createDesignationDto);
  }

  @AuditLog(AuditLogModule.PLATFORM_SETUP, AuditAction.UPDATE, 'platform_designation')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDesignationDto: UpdatePlatformDesignationDto,
  ) {
    return this.platformDesignationService.update(id, updateDesignationDto);
  }

  @AuditLog(AuditLogModule.PLATFORM_SETUP, AuditAction.DELETE, 'platform_designation')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformDesignationService.remove(id);
  }
}
