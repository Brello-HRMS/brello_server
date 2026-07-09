import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import { LeadService } from '../services/lead.service';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { VerifyLeadOtpDto } from '../dto/verify-lead-otp.dto';
import { UpdateLeadStatusDto } from '../dto/update-lead-status.dto';
import { LeadStatus } from '../enums/lead-status.enum';
import { LeadSource } from '../enums/lead-source.enum';

import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  registerLead(
    @Body() createLeadDto: CreateLeadDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.leadService.registerLead(createLeadDto, user);
  }

  @Post('verify-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  verifyLeadOtp(
    @Body() verifyLeadOtpDto: VerifyLeadOtpDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.leadService.verifyLeadOtp(verifyLeadOtpDto, user);
  }

  @Get()
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  findAll(
    @Query('status') status?: LeadStatus,
    @Query('source') source?: LeadSource,
    @LoggedInUser() user?: LoggedInUserInterface,
  ) {
    return this.leadService.findAll({ status, source }, user);
  }

  @Get(':id')
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user?: LoggedInUserInterface,
  ) {
    return this.leadService.findOne(id, user);
  }

  @Patch(':id/status')
  @UseGuards(PlatformAdminGuard)
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStatusDto,
    @LoggedInUser() user?: LoggedInUserInterface,
  ) {
    return this.leadService.updateStatus(id, dto.status, user);
  }
}
