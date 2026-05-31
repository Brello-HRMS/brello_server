import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { StorageService } from '../../document/services/storage.service';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceService } from './invoice.service';

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async ensurePdfUrl(invoice: Invoice): Promise<string> {
    if (!invoice.pdf_s3_key) {
      const key = `invoices/${invoice.organization_id}/${invoice.invoice_number}.pdf`;
      const buf = await this.render(invoice);
      await this.storage.uploadFile(buf, key, 'application/pdf');
      await this.invoiceService.attachPdfKey(invoice, key);
      invoice.pdf_s3_key = key;
    }
    return this.storage.generatePresignedDownloadUrl(invoice.pdf_s3_key, 900);
  }

  private render(invoice: Invoice): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const profile =
        (invoice.billing_profile_snapshot as Record<string, string>) ?? {};

      // Header
      doc.fontSize(20).text('Brello', { continued: false });
      doc.fontSize(10).fillColor('#666').text('HRMS by Rezolut');
      doc.moveDown(0.5);
      doc.fillColor('#000').fontSize(16).text('Tax Invoice', { align: 'right' });
      doc.fontSize(10).text(`Invoice #: ${invoice.invoice_number}`, { align: 'right' });
      doc.text(`Date: ${fmtDate(invoice.invoice_date)}`, { align: 'right' });
      doc.text(`Due: ${fmtDate(invoice.due_date)}`, { align: 'right' });
      doc.moveDown(1.5);

      // Bill-to block
      doc.fontSize(11).text('Billed To', { underline: true });
      doc.fontSize(10);
      doc.text(profile.legal_business_name ?? '-');
      if (profile.gst_number) doc.text(`GSTIN: ${profile.gst_number}`);
      if (profile.billing_address) doc.text(profile.billing_address);
      const cityLine = [profile.state, profile.pincode, profile.country]
        .filter(Boolean)
        .join(', ');
      if (cityLine) doc.text(cityLine);
      if (profile.billing_email) doc.text(profile.billing_email);
      doc.moveDown(1.5);

      // Line items table
      const tableTop = doc.y;
      doc.fontSize(11).fillColor('#000');
      doc.text('Description', 40, tableTop);
      doc.text('Qty', 320, tableTop, { width: 50, align: 'right' });
      doc.text('Unit', 380, tableTop, { width: 80, align: 'right' });
      doc.text('Amount', 470, tableTop, { width: 80, align: 'right' });
      doc.moveTo(40, tableTop + 16).lineTo(555, tableTop + 16).stroke();

      let y = tableTop + 22;
      doc.fontSize(10);
      for (const li of invoice.line_items ?? []) {
        doc.text(li.line_description, 40, y, { width: 270 });
        doc.text(String(li.quantity), 320, y, { width: 50, align: 'right' });
        doc.text(money(li.unit_price), 380, y, { width: 80, align: 'right' });
        doc.text(money(li.amount), 470, y, { width: 80, align: 'right' });
        y += 22;
      }
      doc.moveTo(40, y).lineTo(555, y).stroke();
      y += 10;

      // Tax summary
      doc.fontSize(10);
      doc.text(`Subtotal`, 380, y, { width: 80, align: 'right' });
      doc.text(money(invoice.subtotal), 470, y, { width: 80, align: 'right' });
      y += 16;
      doc.text(`GST (${invoice.gst_rate}%)`, 380, y, { width: 80, align: 'right' });
      doc.text(money(invoice.gst_amount), 470, y, { width: 80, align: 'right' });
      y += 16;
      doc.fontSize(12);
      doc.text(`Total`, 380, y, { width: 80, align: 'right' });
      doc.text(money(invoice.total), 470, y, { width: 80, align: 'right' });

      // Footer
      doc.fontSize(8).fillColor('#888');
      doc.text(
        'Support: contact@brello.co.in   |   Terms: Payment due within 7 days.',
        40,
        780,
        { align: 'center', width: 515 },
      );
      doc.text(`Generated: ${new Date().toISOString()}`, 40, 795, {
        align: 'center',
        width: 515,
      });

      doc.end();
    });
  }
}

function fmtDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

function money(n: number | string): string {
  return `₹${Number(n).toFixed(2)}`;
}
