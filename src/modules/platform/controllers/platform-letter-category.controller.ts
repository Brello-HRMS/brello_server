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
import { PlatformLetterCategoryService } from '../services/platform-letter-category.service';
import { CreateLetterCategoryDto, UpdateLetterCategoryDto } from '../../hr-template/dto/letter-category.dto';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('platform-admin/letter-categories')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformLetterCategoryController {
  constructor(private readonly service: PlatformLetterCategoryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @AuditLog(AuditLogModule.PLATFORM_SETUP, AuditAction.CREATE, 'platform_letter_category')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateLetterCategoryDto) {
    return this.service.create(dto);
  }

  @AuditLog(AuditLogModule.PLATFORM_SETUP, AuditAction.UPDATE, 'platform_letter_category')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLetterCategoryDto,
  ) {
    return this.service.update(id, dto);
  }

  @AuditLog(AuditLogModule.PLATFORM_SETUP, AuditAction.DELETE, 'platform_letter_category')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
