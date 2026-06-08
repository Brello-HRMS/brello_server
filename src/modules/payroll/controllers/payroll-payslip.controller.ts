import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { PayslipService } from '../services/payslip.service';
import { PayslipPdfService } from '../services/payslip-pdf.service';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Controller('payroll')
export class PayrollPayslipController {
  constructor(
    private readonly payslipService: PayslipService,
    private readonly payslipPdfService: PayslipPdfService,
  ) {}

  // ─── Admin: payslip & report (post-lock outputs) ─────────────────────────────

  @Get('runs/:id/payslips/:itemId')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('PAY_PAYSLIP', 'view')
  getPayslip(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.payslipService.getPayslip(user, id, itemId);
  }

  @Get('runs/:id/report')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('PAY_PAYSLIP', 'view')
  getReport(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payslipService.getReport(user, id);
  }

  @Get('runs/:id/payslips/:itemId/pdf')
  @UseGuards(JwtAuthGuard, AccessGuard)
  @RequirePermission('PAY_PAYSLIP', 'view')
  getPayslipPdf(
    @CurrentUser() user: LoggedInUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.payslipPdfService.getDownloadUrl(user, id, itemId);
  }

  // ─── Employee self-service: own payslips ─────────────────────────────────────

  @Get('me/payslips')
  @UseGuards(JwtAuthGuard)
  getMyPayslips(@CurrentUser() user: LoggedInUser) {
    return this.payslipService.getMyPayslips(user);
  }
}
