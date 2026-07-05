import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SignatoryService } from '../services/signatory.service';
import { CreateSignatoryDto, UpdateSignatoryDto } from '../dto/signatory.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../../core/guards/access.guard';
import { RequirePermission } from '../../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../../audit/enums/audit-action.enum';
import { Status } from '../../../../common/enums';

@Controller('letter-management/signatories')
@UseGuards(JwtAuthGuard, AccessGuard)
export class SignatoryController {
  constructor(private readonly signatoryService: SignatoryService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermission('LETTER_SIGNATORIES', 'create')
  @AuditLog(AuditLogModule.LETTER_SIGNATORY, AuditAction.CREATE, 'signatory')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Body() dto: CreateSignatoryDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.signatoryService.create(user, dto, file);
  }

  @Get()
  @RequirePermission('LETTER_SIGNATORIES', 'view')
  @HttpCode(HttpStatus.OK)
  async findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query('status') status?: Status,
    @Query('search') search?: string,
  ) {
    return this.signatoryService.findAll(user, { status, search });
  }

  @Get(':id')
  @RequirePermission('LETTER_SIGNATORIES', 'view')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.signatoryService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermission('LETTER_SIGNATORIES', 'edit')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSignatoryDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.signatoryService.update(user, id, dto);
  }

  @Post(':id/set-default')
  @RequirePermission('LETTER_SIGNATORIES', 'edit')
  @HttpCode(HttpStatus.OK)
  async setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.signatoryService.setDefault(user, id);
  }

  @Delete(':id')
  @RequirePermission('LETTER_SIGNATORIES', 'delete')
  @AuditLog(AuditLogModule.LETTER_SIGNATORY, AuditAction.ARCHIVE, 'signatory')
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.signatoryService.archive(user, id);
  }
}
