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
  Req,
} from '@nestjs/common';
import { DocumentService } from '../services/document.service';
import { GenerateUploadUrlDto } from '../dto/generate-upload-url.dto';
import { ConfirmUploadDto } from '../dto/confirm-upload.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// Custom interface for the Request with standard JWT user
interface RequestWithUser extends Request {
  user: { userId: string; [key: string]: any };
}

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.CREATED)
  generateUploadUrl(
    @Body() dto: GenerateUploadUrlDto,
    @Req() req: RequestWithUser,
  ) {
    return this.documentService.generateUploadUrl(req.user.userId, dto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirmUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmUploadDto,
    @Req() req: RequestWithUser,
  ) {
    // Enforce that the path ID matches the body ID (optional consistency check)
    if (dto.id && dto.id !== id) {
      throw new Error('Path ID and Body ID mismatch');
    }
    return this.documentService.confirmUpload(id, req.user.userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentService.findOne(id);
  }

  @Get(':id/signed-url')
  @HttpCode(HttpStatus.OK)
  getSignedUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentService.getSignedUrl(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.documentService.remove(id, req.user.userId);
  }
}
