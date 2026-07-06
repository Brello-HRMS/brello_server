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
        doc.moveDown(1);
        
        const startX = 50;
        const col2X = 300;
        const endX = 545; // 595.28 (A4 width) - 50 margin
        
        const tableTop = doc.y;
        let currentY = tableTop;
        
        // Top border
        doc.moveTo(startX, currentY).lineTo(endX, currentY).strokeColor('#e5e7eb').lineWidth(1).stroke();
        
        // Header
        const headerY = currentY + 10;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151');
        doc.text('Component', startX + 12, headerY);
        const hy1 = doc.y;
        doc.text('Amount', col2X + 12, headerY);
        const hy2 = doc.y;
        currentY = Math.max(hy1, hy2) + 10;
        
        // Header bottom border
        doc.moveTo(startX, currentY).lineTo(endX, currentY).strokeColor('#e5e7eb').lineWidth(1).stroke();
        
        // Rows
        doc.font('Helvetica').fontSize(10).fillColor('#4b5563');
        for (const component of model.salaryTable.components) {
          const yBefore = currentY + 10;
          
          doc.text(component.component_name, startX + 12, yBefore, { width: col2X - startX - 24 });
          const yAfter1 = doc.y;
          
          doc.text(`₹${component.amount}`, col2X + 12, yBefore);
          const yAfter2 = doc.y;
          
          currentY = Math.max(yAfter1, yAfter2) + 10;
          doc.moveTo(startX, currentY).lineTo(endX, currentY).strokeColor('#e5e7eb').lineWidth(1).stroke();
        }
        
        // Total row
        const yTotal = currentY + 10;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827');
        doc.text('Total', startX + 12, yTotal);
        const ty1 = doc.y;
        doc.text(`₹${model.salaryTable.total}`, col2X + 12, yTotal);
        const ty2 = doc.y;
        
        currentY = Math.max(ty1, ty2) + 10;
        doc.moveTo(startX, currentY).lineTo(endX, currentY).strokeColor('#e5e7eb').lineWidth(1).stroke();
        
        // Draw vertical borders
        doc.moveTo(startX, tableTop).lineTo(startX, currentY).strokeColor('#e5e7eb').lineWidth(1).stroke();
        doc.moveTo(col2X, tableTop).lineTo(col2X, currentY).strokeColor('#e5e7eb').lineWidth(1).stroke();
        doc.moveTo(endX, tableTop).lineTo(endX, currentY).strokeColor('#e5e7eb').lineWidth(1).stroke();
        
        // Reset positioning and fonts
        doc.x = startX;
        doc.y = currentY;
        doc.moveDown(1.5);
        doc.font('Helvetica').fillColor('#000000');
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
