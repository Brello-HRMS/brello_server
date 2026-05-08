import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { EmployeeAnnouncementService } from '../services/employee-announcement.service';
import { EmployeeAnnouncementQueryDto } from '../dto/employee-query.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

interface AuthPayload {
  userId: string;
  enterpriseId: string;
  organizationId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('employee/announcements')
export class EmployeeAnnouncementController {
  constructor(private readonly employeeAnnouncementService: EmployeeAnnouncementService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthPayload,
    @Query() query: EmployeeAnnouncementQueryDto,
  ) {
    return this.employeeAnnouncementService.findForEmployee(
      user.userId,
      user.enterpriseId,
      user.organizationId,
      query,
    );
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.employeeAnnouncementService.markRead(id, user.userId);
  }
}
