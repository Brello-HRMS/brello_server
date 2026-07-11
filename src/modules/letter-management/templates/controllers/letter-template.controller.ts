import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { LetterTemplateService } from '../services/letter-template.service';
import { CreateLetterTemplateDto, UpdateLetterTemplateDto } from '../dto/letter-template.dto';
import { TemplateStatus } from '../enums/template-status.enum';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../../core/guards/access.guard';
import { RequirePermission } from '../../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../../audit/enums/audit-action.enum';

@Controller('letter-management/templates')
@UseGuards(JwtAuthGuard, AccessGuard)
export class LetterTemplateController {
  constructor(private readonly templateService: LetterTemplateService) {}

  @AuditLog(AuditLogModule.LETTER_MANAGEMENT, AuditAction.CREATE, 'letter_template')
  @Post()
  @RequirePermission('LETTER_TEMPLATES', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(@LoggedInUser() user: LoggedInUserInterface, @Body() dto: CreateLetterTemplateDto) {
    return this.templateService.create(user, dto);
  }

  @Get()
  @RequirePermission('LETTER_TEMPLATES', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query('category_id') category_id?: string,
    @Query('status') status?: TemplateStatus,
    @Query('search') search?: string,
  ) {
    return this.templateService.findAll(user, { category_id, template_status: status, search });
  }

  @Get(':id')
  @RequirePermission('LETTER_TEMPLATES', 'view')
  findOne(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.findOne(user, id);
  }

  @Post(':id/preview')
  @RequirePermission('LETTER_TEMPLATES', 'view')
  @HttpCode(HttpStatus.OK)
  preview(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.preview(user, id);
  }

  @Patch(':id')
  @RequirePermission('LETTER_TEMPLATES', 'edit')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLetterTemplateDto,
  ) {
    return this.templateService.update(user, id, dto);
  }

  @AuditLog(AuditLogModule.LETTER_MANAGEMENT, AuditAction.PUBLISH, 'letter_template')
  @Post(':id/publish')
  @RequirePermission('LETTER_TEMPLATES', 'edit')
  @HttpCode(HttpStatus.OK)
  publish(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.publish(user, id);
  }

  @AuditLog(AuditLogModule.LETTER_MANAGEMENT, AuditAction.CREATE, 'letter_template')
  @Post(':id/duplicate')
  @RequirePermission('LETTER_TEMPLATES', 'create')
  @HttpCode(HttpStatus.CREATED)
  duplicate(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.duplicate(user, id);
  }

  @AuditLog(AuditLogModule.LETTER_MANAGEMENT, AuditAction.ARCHIVE, 'letter_template')
  @Delete(':id')
  @RequirePermission('LETTER_TEMPLATES', 'delete')
  @HttpCode(HttpStatus.OK)
  archive(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.archive(user, id);
  }

  @AuditLog(AuditLogModule.LETTER_MANAGEMENT, AuditAction.UPDATE, 'letter_template')
  @Post(':id/unarchive')
  @RequirePermission('LETTER_TEMPLATES', 'delete')
  @HttpCode(HttpStatus.OK)
  unarchive(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.unarchive(user, id);
  }
}
