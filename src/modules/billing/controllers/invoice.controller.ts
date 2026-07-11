import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { InvoiceService } from '../services/invoice.service';
import { InvoicePdfService } from '../services/invoice-pdf.service';
import { ListInvoicesDto } from '../dto/list-invoices.dto';

@Controller('billing/invoices')
@UseGuards(JwtAuthGuard, AccessGuard)
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly pdfService: InvoicePdfService,
  ) {}

  @Get('current')
  @RequirePermission('BILLING', 'view')
  @HttpCode(HttpStatus.OK)
  async getCurrent(@LoggedInUser() user: LoggedInUserInterface) {
    const invoice = await this.invoiceService.findCurrent(user.organizationId);
    if (!invoice) throw new NotFoundException('No open invoice');
    return invoice;
  }

  @Get()
  @RequirePermission('BILLING', 'view')
  @HttpCode(HttpStatus.OK)
  list(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListInvoicesDto,
  ) {
    return this.invoiceService.list(user.organizationId, {
      invoice_status: query.invoice_status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get(':id')
  @RequirePermission('BILLING', 'view')
  @HttpCode(HttpStatus.OK)
  findOne(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoiceService.findOne(id, user.organizationId);
  }

  @Get(':id/pdf')
  @RequirePermission('BILLING', 'view')
  @HttpCode(HttpStatus.OK)
  async getPdfUrl(
    @LoggedInUser() user: LoggedInUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const invoice = await this.invoiceService.findOne(id, user.organizationId);
    const url = await this.pdfService.ensurePdfUrl(invoice);
    return { url, expires_in_seconds: 900 };
  }
}
