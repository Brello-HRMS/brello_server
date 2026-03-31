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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
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
    return this.documentService.confirmUpload(id, user);
  }

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async uploadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: any,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.documentService.uploadFileContent(id, file.buffer, user);
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

  @Get(':id/view')
  async view(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    const { buffer, mimeType, fileName } =
      await this.documentService.getFileData(id);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    const { buffer, mimeType, fileName } =
      await this.documentService.getFileData(id);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
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
