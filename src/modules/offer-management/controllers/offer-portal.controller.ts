import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OfferPortalService } from '../services/offer-portal.service';
import {
  CandidateAcceptDto,
  CandidateRejectDto,
  CandidateRequestChangesDto,
} from '../dto/offer-portal.dto';

/**
 * Public controller — no JWT, no AccessGuard.
 * All endpoints authenticated via access_token in the request body.
 * This is the external-facing Candidate Portal API.
 */
@Controller('offer-portal')
export class OfferPortalController {
  constructor(private readonly portalService: OfferPortalService) {}

  /** Fetch offer data for the candidate portal. Token in URL path. */
  @Get(':token')
  getPortalData(@Param('token') token: string) {
    return this.portalService.getPortalData(token);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  accept(@Body() dto: CandidateAcceptDto) {
    return this.portalService.accept(dto);
  }

  @Post('reject')
  @HttpCode(HttpStatus.OK)
  reject(@Body() dto: CandidateRejectDto) {
    return this.portalService.reject(dto);
  }

  @Post('request-changes')
  @HttpCode(HttpStatus.OK)
  requestChanges(@Body() dto: CandidateRequestChangesDto) {
    return this.portalService.requestChanges(dto);
  }

  @Post(':token/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadOnboardingDocument(
    @Param('token') token: string,
    @Body('name') name: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('File is required');
    if (!name) throw new BadRequestException('Document name is required');
    
    return this.portalService.uploadOnboardingDocument(token, name, file);
  }
}
