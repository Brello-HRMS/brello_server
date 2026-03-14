import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { DocumentService } from '../services/document.service';
import { GenerateUploadUrlDto } from '../dto/generate-upload-url.dto';
import { ConfirmUploadDto } from '../dto/confirm-upload.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.CREATED)
  generateUploadUrl(
    @Body() dto: GenerateUploadUrlDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.documentService.generateUploadUrl(user, dto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirmUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmUploadDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    // Enforce that the path ID matches the body ID (optional consistency check)
    if (dto.id && dto.id !== id) {
      throw new Error('Path ID and Body ID mismatch');
    }
    return this.documentService.confirmUpload(id, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.documentService.findOne(id, user);
  }

  @Get(':id/signed-url')
  @HttpCode(HttpStatus.OK)
  getSignedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.documentService.getSignedUrl(id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.documentService.remove(id, user);
  }
}
