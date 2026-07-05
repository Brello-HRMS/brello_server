import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { RenderModel } from '../interfaces/render-model.interface';

/**
 * Renders a LetterRenderModel into a PDF buffer with pdfkit — same library
 * and buffering approach as PayslipPdfService. UNLIKE the payslip service,
 * this is never called lazily on download: an issued letter's PDF is
 * generated exactly once at issuance time and stored permanently, since the
 * document itself is the immutable legal record. Do not add a "regenerate if
 * missing" path here — that would defeat the whole point of the snapshot.
 */
@Injectable()
export class PdfBuilderService {
  build(model: RenderModel): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (model.heading) {
        doc.fontSize(16).text(model.heading, { align: 'left' });
        doc.moveDown(1);
      }

      doc.fontSize(11);
      for (const paragraph of model.paragraphs) {
        doc.text(paragraph, { align: 'left' });
        doc.moveDown(0.6);
      }

      if (model.bulletList.length > 0) {
        doc.moveDown(0.2);
        for (const bullet of model.bulletList) {
          doc.text(`•  ${bullet}`, { align: 'left', indent: 10 });
        }
        doc.moveDown(0.6);
      }

      if (model.salaryTable) {
        doc.moveDown(0.4).fontSize(12).text('Salary Details', { underline: true });
        doc.fontSize(10);
        for (const component of model.salaryTable.components) {
          doc.text(`${component.component_name}: ₹${component.amount}`);
        }
        doc.moveDown(0.2).fontSize(11).text(`Total: ₹${model.salaryTable.total}`, {
          underline: true,
        });
        doc.moveDown(0.6);
      }

      if (model.signatory) {
        doc.moveDown(1.5);
        doc.fontSize(11).text(model.signatory.name);
        doc.fontSize(10).fillColor('#555').text(model.signatory.designation);
        doc.fillColor('#000');
      }

      doc.end();
    });
  }
}
