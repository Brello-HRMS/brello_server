import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ReimbursementService } from '../services/reimbursement.service';
import { CreateReimbursementDto } from '../dto/create-reimbursement.dto';
import { UpdateReimbursementDto } from '../dto/update-reimbursement.dto';
import { EmployeeReimbursementQueryDto } from '../dto/employee-query.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

interface AuthPayload {
  userId: string;
  enterpriseId: string;
  organizationId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('reimbursements')
export class ReimbursementController {
  constructor(private readonly reimbursementService: ReimbursementService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateReimbursementDto,
  ) {
    return this.reimbursementService.create(
      user.userId,
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  @Get('me')
  async findMine(
    @CurrentUser() user: AuthPayload,
    @Query() query: EmployeeReimbursementQueryDto,
  ) {
    return this.reimbursementService.findMine(
      user.userId,
      user.enterpriseId,
      user.organizationId,
      query,
    );
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() dto: UpdateReimbursementDto,
  ) {
    return this.reimbursementService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@CurrentUser() user: AuthPayload, @Param('id') id: string) {
    return this.reimbursementService.remove(user.userId, id);
  }
}
