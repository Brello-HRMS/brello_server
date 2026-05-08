import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { AnnouncementService } from '../services/announcement.service';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';
import { UpdateAnnouncementDto } from '../dto/update-announcement.dto';
import { AdminAnnouncementQueryDto } from '../dto/admin-query.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

interface AuthPayload {
  userId: string;
  enterpriseId: string;
  organizationId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Post()
  async create(@CurrentUser() user: AuthPayload, @Body() dto: CreateAnnouncementDto) {
    return this.announcementService.create(
      user.enterpriseId,
      user.organizationId,
      user.userId,
      dto,
    );
  }

  @Get()
  async findAll(@CurrentUser() user: AuthPayload, @Query() query: AdminAnnouncementQueryDto) {
    return this.announcementService.findAll(user.enterpriseId, user.organizationId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.announcementService.findOne(id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.announcementService.remove(id, user.userId);
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.announcementService.publish(id, user.userId);
  }

  @Post(':id/archive')
  @HttpCode(200)
  async archive(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.announcementService.archive(id, user.userId);
  }
}
