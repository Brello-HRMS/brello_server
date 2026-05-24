import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { DocumentService } from '../services/document.service';
import { verifyDocumentView } from '../utils/document-signature.util';

/**
 * Public, signature-gated view endpoint for documents stored in the database.
 *
 * `<img>` tags can't carry an Authorization header, so the existing JWT-guarded
 * view route was unusable for rendering avatars in the browser. URLs returned
 * by the API now include `?sig=<hmac>&exp=<unix-seconds>`; we verify the HMAC
 * here (signed against JWT_SECRET) and serve the file bytes if it is valid and
 * unexpired. Mirrors the S3 pre-signed URL pattern so dev and prod behave the
 * same on the client.
 */
@Controller('documents')
export class DocumentViewController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly configService: ConfigService,
  ) {}

  @Get(':id/view')
  async view(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('sig') sig: string,
    @Query('exp') exp: string,
    @Res() res: Response,
  ) {
    const secret = this.configService.get<string>('auth.JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Signing secret not configured');
    }
    const expNum = Number(exp);
    if (!verifyDocumentView(id, sig, expNum, secret)) {
      throw new UnauthorizedException('Invalid or expired signature');
    }

    const { buffer, mimeType, fileName } =
      await this.documentService.getFileData(id);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    // Browsers can cache the bytes for the life of the signature.
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.send(buffer);
  }
}
