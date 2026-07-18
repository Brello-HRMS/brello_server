import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
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
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { DocumentService } from '../services/document.service';
import { GenerateUploadUrlDto } from '../dto/generate-upload-url.dto';
import { ConfirmUploadDto } from '../dto/confirm-upload.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { MAX_UPLOAD_SIZE_BYTES } from '../constants/document.constants';
import { UserThrottlerGuard } from '../../../common/guards/user-throttler.guard';

@Controller('documents')
@UseGuards(JwtAuthGuard, AccessGuard, UserThrottlerGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload-url')
  @RequirePermission('DOCUMENTS', 'create')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  generateUploadUrl(
    @Body() dto: GenerateUploadUrlDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.documentService.generateUploadUrl(user, dto);
  }

  @Post(':id/confirm')
  @RequirePermission('DOCUMENTS', 'create')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  confirmUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmUploadDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    if (dto.id !== id) {
      throw new BadRequestException('id in body does not match id in path');
    }
    return this.documentService.confirmUpload(id, user);
  }

  @Post(':id/upload')
  @RequirePermission('DOCUMENTS', 'create')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_SIZE_BYTES } }),
  )
  @HttpCode(HttpStatus.OK)
  async uploadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile()
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.documentService.uploadFileContent(id, file.buffer, user);
  }

  @Get(':id')
  @RequirePermission('DOCUMENTS', 'view')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.documentService.findOne(id, user);
  }

  @Get(':id/signed-url')
  @RequirePermission('DOCUMENTS', 'view')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  getSignedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.documentService.getSignedUrl(id, user);
  }

  @Get(':id/download')
  @RequirePermission('DOCUMENTS', 'view')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    const { buffer, mimeType, fileName } =
      await this.documentService.getFileData(id, user);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  @AuditLog(AuditLogModule.DOCUMENT, AuditAction.DELETE, 'document')
  @Delete(':id')
  @RequirePermission('DOCUMENTS', 'delete')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.documentService.remove(id, user);
  }
}
