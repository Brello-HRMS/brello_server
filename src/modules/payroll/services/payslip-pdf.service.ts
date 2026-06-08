import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { StorageService } from '../../document/services/storage.service';
import { PayrollRunItemRepository } from '../repositories/payroll-run-item.repository';
import { PayslipService } from './payslip.service';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollItemStatus } from '../enums/payroll.enum';

const MONTH_LABELS: Record<string, string> = {
  jan: 'January', feb: 'February', mar: 'March', apr: 'April',
  may: 'May', jun: 'June', jul: 'July', aug: 'August',
  sep: 'September', oct: 'October', nov: 'November', dec: 'December',
};

/**
 * Renders payslip PDFs with pdfkit and stores them in S3 via the shared
 * StorageService. PDFs are generated when a run is locked; the download endpoint
 * regenerates lazily if a key is missing.
 */
@Injectable()
export class PayslipPdfService {
  private readonly logger = new Logger(PayslipPdfService.name);

  constructor(
    private readonly itemRepo: PayrollRunItemRepository,
    private readonly payslipService: PayslipService,
    private readonly storage: StorageService,
  ) {}

  /** Generates and stores a PDF for every processed item in a locked run. */
  async generateForRun(user: LoggedInUser, run: PayrollRun): Promise<void> {
    const items = await this.itemRepo.findAllByRun(run.id);
    for (const item of items) {
      if (item.item_status !== PayrollItemStatus.PROCESSED) continue;
      try {
        await this.renderAndStore(user, run.id, item.id);
      } catch (err) {
        // A single bad payslip must not abort the lock; log and move on.
        this.logger.error(
          `Failed to generate payslip PDF for item ${item.id}: ${String(err)}`,
        );
      }
    }
  }

  /** Returns a presigned download URL, generating the PDF on demand if needed. */
  async getDownloadUrl(
    user: LoggedInUser,
    runId: string,
    itemId: string,
  ): Promise<{ url: string }> {
    const item = await this.itemRepo.findById(user.organizationId, runId, itemId);
    if (!item) {
      throw new NotFoundException('Payroll item not found.');
    }

    let key = item.payslip_pdf_key;
    if (!key) {
      key = await this.renderAndStore(user, runId, itemId);
    }

    const url = await this.storage.generatePresignedDownloadUrl(key);
    return { url };
  }

  /** Builds the payslip payload, renders a PDF, uploads it, and stores the key. */
  private async renderAndStore(
    user: LoggedInUser,
    runId: string,
    itemId: string,
  ): Promise<string> {
    const payslip = await this.payslipService.getPayslip(user, runId, itemId);
    const buffer = await this.render(payslip);
    const key = `payslips/${user.organizationId}/${runId}/${itemId}.pdf`;
    await this.storage.uploadFile(buffer, key, 'application/pdf');

    const item = await this.itemRepo.findById(user.organizationId, runId, itemId);
    if (item) {
      item.payslip_pdf_key = key;
      await this.itemRepo.save(item);
    }
    return key;
  }

  /** Lays out a single payslip into a PDF buffer. */
  private render(payslip: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const money = (n: number) =>
        `INR ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      const period = `${MONTH_LABELS[payslip.period.month] ?? payslip.period.month} ${payslip.period.year}`;

      // Header
      doc.fontSize(18).text('Payslip', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#555').text(period, { align: 'center' });
      doc.fillColor('#000').moveDown(1);

      doc.fontSize(12).text(`Employee: ${payslip.employee.name || payslip.employee.user_id}`);
      doc.moveDown(0.8);

      // Attendance
      const att = payslip.attendance;
      doc.fontSize(11).text(
        `Working days: ${att.total_working_days}   Present: ${att.present_days}   ` +
          `Paid leave: ${att.paid_leave_days}   LOP: ${att.lop_days}`,
      );
      doc.moveDown(0.8);

      this.section(doc, 'Earnings', payslip.earnings, money);
      this.section(doc, 'Deductions', payslip.deductions, money);

      if (payslip.adjustments?.length) {
        doc.moveDown(0.4).fontSize(12).text('Adjustments', { underline: true });
        for (const a of payslip.adjustments) {
          doc.fontSize(10).text(`${a.type}: ${money(a.amount)}${a.reason ? ` (${a.reason})` : ''}`);
        }
      }

      // Summary
      const s = payslip.summary;
      doc.moveDown(0.8).fontSize(12).text('Summary', { underline: true });
      doc.fontSize(11);
      doc.text(`Gross: ${money(s.gross)}`);
      doc.text(`Deductions: ${money(s.deductions_total)}`);
      doc.text(`Reimbursements: ${money(s.reimbursement_total)}`);
      doc.moveDown(0.3).fontSize(13).text(`Net Pay: ${money(s.net)}`, { underline: true });

      doc.end();
    });
  }

  private section(
    doc: PDFKit.PDFDocument,
    title: string,
    lines: { name: string; calculated_value?: number; value?: number }[],
    money: (n: number) => string,
  ): void {
    doc.moveDown(0.4).fontSize(12).text(title, { underline: true });
    doc.fontSize(10);
    if (!lines?.length) {
      doc.fillColor('#888').text('—').fillColor('#000');
      return;
    }
    for (const line of lines) {
      const amt = line.calculated_value ?? line.value ?? 0;
      doc.text(`${line.name}: ${money(amt)}`);
    }
  }
}
