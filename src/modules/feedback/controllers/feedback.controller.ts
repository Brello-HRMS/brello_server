import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { FeedbackService } from '../services/feedback.service';
import { CreateFeedbackTicketDto } from '../dto/create-feedback-ticket.dto';
import { AddCommentDto } from '../dto/add-comment.dto';
import { OrgQueryFeedbackDto } from '../dto/org-query-feedback.dto';

interface AuthPayload {
  userId: string;
  enterpriseId: string;
  organizationId: string;
}

@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('feedback-tickets')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('SUPPORT_FEEDBACK', 'create')
  create(@CurrentUser() user: AuthPayload, @Body() dto: CreateFeedbackTicketDto) {
    return this.feedbackService.create(
      user.userId,
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  @Get()
  @RequirePermission('SUPPORT_FEEDBACK', 'view')
  findAll(@CurrentUser() user: AuthPayload, @Query() query: OrgQueryFeedbackDto) {
    return this.feedbackService.findAll(
      user.organizationId,
      user.enterpriseId,
      query,
    );
  }

  @Get(':id')
  @RequirePermission('SUPPORT_FEEDBACK', 'view')
  findOne(@CurrentUser() user: AuthPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.feedbackService.findOne(id, user.organizationId);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('SUPPORT_FEEDBACK', 'create')
  addComment(
    @CurrentUser() user: AuthPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.feedbackService.addComment(id, user.userId, user.organizationId, dto);
  }
}
