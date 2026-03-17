import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { LeadService } from '../services/lead.service';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { VerifyLeadOtpDto } from '../dto/verify-lead-otp.dto';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('leads')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  registerLead(
    @Body() createLeadDto: CreateLeadDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.leadService.registerLead(createLeadDto, user);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyLeadOtp(
    @Body() verifyLeadOtpDto: VerifyLeadOtpDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.leadService.verifyLeadOtp(verifyLeadOtpDto, user);
  }
}
