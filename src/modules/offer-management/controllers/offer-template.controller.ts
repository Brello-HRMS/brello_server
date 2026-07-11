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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { OfferTemplateService } from '../services/offer-template.service';
import {
  CreateOfferTemplateDto,
  UpdateOfferTemplateDto,
  FilterOfferTemplatesDto,
} from '../dto/offer-template.dto';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('offer-management/templates')
@UseGuards(JwtAuthGuard, AccessGuard)
export class OfferTemplateController {
  constructor(private readonly templateService: OfferTemplateService) {}

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.CREATE, 'offer_template')
  @Post()
  @RequirePermission('OFFER_CANDIDATES', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateOfferTemplateDto,
  ) {
    return this.templateService.create(user, dto);
  }

  @Get()
  @RequirePermission('OFFER_CANDIDATES', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() filters: FilterOfferTemplatesDto,
  ) {
    return this.templateService.findAll(user, filters);
  }

  @Get(':id')
  @RequirePermission('OFFER_CANDIDATES', 'view')
  findOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templateService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferTemplateDto,
  ) {
    return this.templateService.update(user, id, dto);
  }

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.PUBLISH, 'offer_template')
  @Post(':id/publish')
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  @HttpCode(HttpStatus.OK)
  publish(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templateService.publish(user, id);
  }

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.CREATE, 'offer_template')
  @Post(':id/duplicate')
  @RequirePermission('OFFER_CANDIDATES', 'create')
  @HttpCode(HttpStatus.CREATED)
  duplicate(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templateService.duplicate(user, id);
  }

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.ARCHIVE, 'offer_template')
  @Delete(':id')
  @RequirePermission('OFFER_CANDIDATES', 'delete')
  @HttpCode(HttpStatus.OK)
  archive(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templateService.archive(user, id);
  }
}
