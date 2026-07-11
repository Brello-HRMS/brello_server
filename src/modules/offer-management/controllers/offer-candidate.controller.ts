import {
  Controller,
  Get,
  Post,
  Patch,
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
import { OfferCandidateService } from '../services/offer-candidate.service';
import {
  CreateOfferCandidateDto,
  UpdateOfferCandidateDto,
  FilterCandidatesDto,
} from '../dto/offer-candidate.dto';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('offer-management/candidates')
@UseGuards(JwtAuthGuard, AccessGuard)
export class OfferCandidateController {
  constructor(private readonly candidateService: OfferCandidateService) {}

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.CREATE, 'offer_candidate')
  @Post()
  @RequirePermission('OFFER_CANDIDATES', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CreateOfferCandidateDto,
  ) {
    return this.candidateService.create(user, dto);
  }

  @Get()
  @RequirePermission('OFFER_CANDIDATES', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() filters: FilterCandidatesDto,
  ) {
    return this.candidateService.findAll(user, filters);
  }

  @Get(':id')
  @RequirePermission('OFFER_CANDIDATES', 'view')
  findOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.candidateService.findOne(user, id);
  }

  @AuditLog(AuditLogModule.OFFER_MANAGEMENT, AuditAction.UPDATE, 'offer_candidate')
  @Patch(':id')
  @RequirePermission('OFFER_CANDIDATES', 'edit')
  update(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferCandidateDto,
  ) {
    return this.candidateService.update(user, id, dto);
  }
}
