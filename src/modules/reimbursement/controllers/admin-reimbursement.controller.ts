import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { AdminReimbursementService } from '../services/admin-reimbursement.service';
import { AdminReimbursementQueryDto } from '../dto/admin-query.dto';
import { UpdateStatusDto } from '../dto/update-status.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

interface AuthPayload {
  userId: string;
  enterpriseId: string;
  organizationId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('admin/reimbursements')
export class AdminReimbursementController {
  constructor(private readonly adminReimbursementService: AdminReimbursementService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthPayload,
    @Query() query: AdminReimbursementQueryDto,
  ) {
    return this.adminReimbursementService.findAll(
      user.enterpriseId,
      user.organizationId,
      query,
    );
  }

  @Patch(':id/status')
  @HttpCode(200)
  async updateStatus(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.adminReimbursementService.updateStatus(id, dto, user.userId);
  }

  @Patch(':id/mark-paid')
  @HttpCode(200)
  async markPaid(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.adminReimbursementService.markPaid(id, user.userId);
  }
}
