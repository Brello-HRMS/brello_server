import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';
import { PlatformLetterTemplateService } from '../services/platform-letter-template.service';
import { CreateLetterTemplateDto, UpdateLetterTemplateDto } from '../../hr-template/dto/letter-template.dto';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('platform-admin/letter-templates')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformLetterTemplateController {
  constructor(private readonly service: PlatformLetterTemplateService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@Query('category_id') categoryId?: string) {
    return this.service.findAll(categoryId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @AuditLog(AuditLogModule.PLATFORM_SETUP, AuditAction.CREATE, 'platform_letter_template')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateLetterTemplateDto) {
    return this.service.create(dto);
  }

  @AuditLog(AuditLogModule.PLATFORM_SETUP, AuditAction.UPDATE, 'platform_letter_template')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLetterTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @AuditLog(AuditLogModule.PLATFORM_SETUP, AuditAction.DELETE, 'platform_letter_template')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
