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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { LetterCategoryService } from '../services/letter-category.service';
import { CreateLetterCategoryDto, UpdateLetterCategoryDto } from '../dto/letter-category.dto';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('letter-categories')
@UseGuards(JwtAuthGuard)
export class LetterCategoryController {
  constructor(private readonly service: LetterCategoryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user, id);
  }

  @AuditLog(AuditLogModule.HR_TEMPLATE, AuditAction.CREATE, 'letter_category')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateLetterCategoryDto,
  ) {
    return this.service.create(user, dto);
  }

  @AuditLog(AuditLogModule.HR_TEMPLATE, AuditAction.UPDATE, 'letter_category')
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLetterCategoryDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @AuditLog(AuditLogModule.HR_TEMPLATE, AuditAction.DELETE, 'letter_category')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user, id);
  }
}
