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
import { LetterCategoryService } from '../services/letter-category.service';
import { CreateLetterCategoryDto, UpdateLetterCategoryDto } from '../dto/letter-category.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../../core/guards/access.guard';
import { RequirePermission } from '../../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../../audit/enums/audit-action.enum';

@Controller('letter-management/categories')
@UseGuards(JwtAuthGuard, AccessGuard)
export class LetterCategoryController {
  constructor(private readonly categoryService: LetterCategoryService) {}

  @AuditLog(AuditLogModule.LETTER_MANAGEMENT, AuditAction.CREATE, 'letter_category')
  @Post()
  @RequirePermission('LETTER_TEMPLATES', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(@LoggedInUser() user: LoggedInUserInterface, @Body() dto: CreateLetterCategoryDto) {
    return this.categoryService.create(user, dto);
  }

  @Get()
  @RequirePermission('LETTER_TEMPLATES', 'view')
  findAll(@LoggedInUser() user: LoggedInUserInterface, @Query('search') search?: string) {
    return this.categoryService.findAll(user, { search });
  }

  @Get(':id')
  @RequirePermission('LETTER_TEMPLATES', 'view')
  findOne(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.categoryService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermission('LETTER_TEMPLATES', 'edit')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLetterCategoryDto,
  ) {
    return this.categoryService.update(user, id, dto);
  }

  @AuditLog(AuditLogModule.LETTER_MANAGEMENT, AuditAction.ARCHIVE, 'letter_category')
  @Delete(':id')
  @RequirePermission('LETTER_TEMPLATES', 'delete')
  @HttpCode(HttpStatus.OK)
  archive(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.categoryService.archive(user, id);
  }

  @AuditLog(AuditLogModule.LETTER_MANAGEMENT, AuditAction.UPDATE, 'letter_category')
  @Post(':id/unarchive')
  @RequirePermission('LETTER_TEMPLATES', 'delete')
  @HttpCode(HttpStatus.OK)
  unarchive(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.categoryService.unarchive(user, id);
  }
}
