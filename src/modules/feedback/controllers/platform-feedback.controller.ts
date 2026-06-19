import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../core/guards/platform-admin.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PlatformFeedbackService } from '../services/platform-feedback.service';
import { PlatformQueryFeedbackDto } from '../dto/platform-query-feedback.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { PlatformAddCommentDto } from '../dto/platform-add-comment.dto';

interface AuthPayload {
  userId: string;
}

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('platform/feedback-tickets')
export class PlatformFeedbackController {
  constructor(private readonly platformFeedbackService: PlatformFeedbackService) {}

  @Get('stats')
  getStats() {
    return this.platformFeedbackService.getStats();
  }

  @Get()
  findAll(@Query() query: PlatformQueryFeedbackDto) {
    return this.platformFeedbackService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformFeedbackService.findOne(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.platformFeedbackService.update(id, user.userId, dto);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  addComment(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlatformAddCommentDto,
  ) {
    return this.platformFeedbackService.addComment(id, user.userId, dto);
  }
}
