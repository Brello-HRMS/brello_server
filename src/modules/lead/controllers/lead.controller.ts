import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { LeadService } from '../services/lead.service';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { VerifyLeadOtpDto } from '../dto/verify-lead-otp.dto';

@Controller('leads')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  registerLead(@Body() createLeadDto: CreateLeadDto) {
    return this.leadService.registerLead(createLeadDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyLeadOtp(@Body() verifyLeadOtpDto: VerifyLeadOtpDto) {
    return this.leadService.verifyLeadOtp(verifyLeadOtpDto);
  }
}
