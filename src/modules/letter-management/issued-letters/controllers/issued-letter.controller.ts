import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IssuedLetterService } from '../services/issued-letter.service';
import {
  GenerateIssuedLetterDto,
  ResolveIssuedLetterDto,
  IssuedLetterFiltersDto,
} from '../dto/issued-letter.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { AccessGuard } from '../../../../core/guards/access.guard';
import { RequirePermission } from '../../../../core/guards/require-permission.decorator';
import { LoggedInUser } from '../../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../../auth/interfaces/logged-in-user.interface';

@Controller('letter-management')
export class IssuedLetterController {
  constructor(private readonly issuedLetterService: IssuedLetterService) {}

  // ── Org-admin routes (RBAC-gated) ─────────────────────────────────────────

  @Get('employees/search')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LETTER_ISSUED', 'view')
  searchEmployees(@LoggedInUser() user: LoggedInUserInterface) {
    return this.issuedLetterService.searchEmployees(user);
  }

  @Post('issued-letters/resolve')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LETTER_ISSUED', 'view')
  @HttpCode(HttpStatus.OK)
  resolve(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: ResolveIssuedLetterDto,
  ) {
    return this.issuedLetterService.resolve(user, dto);
  }

  @Get('issued-letters')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LETTER_ISSUED', 'view')
  findAll(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() filters: IssuedLetterFiltersDto,
  ) {
    return this.issuedLetterService.findAll(user, filters);
  }

  @Post('issued-letters')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LETTER_ISSUED', 'create')
  @HttpCode(HttpStatus.CREATED)
  generate(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: GenerateIssuedLetterDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.issuedLetterService.generate(user, dto, idempotencyKey);
  }

  @Get('issued-letters/:id')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LETTER_ISSUED', 'view')
  findOne(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.issuedLetterService.findOne(user, id);
  }

  @Get('issued-letters/:id/download')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('LETTER_ISSUED', 'view')
  download(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.issuedLetterService.download(user, id);
  }

  // ── Employee self-service routes (authenticated only, no RBAC) ───────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(@LoggedInUser() user: LoggedInUserInterface) {
    return this.issuedLetterService.findMine(user);
  }

  @Get('me/:id')
  @UseGuards(JwtAuthGuard)
  findMineById(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.issuedLetterService.findMineById(user, id);
  }

  @Get('me/:id/download')
  @UseGuards(JwtAuthGuard)
  downloadMine(@LoggedInUser() user: LoggedInUserInterface, @Param('id', ParseUUIDPipe) id: string) {
    return this.issuedLetterService.downloadMine(user, id);
  }
}
