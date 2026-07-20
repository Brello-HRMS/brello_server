import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer';
import { PdfBuilderService } from '../../letter-management/shared/services/pdf-builder.service';
import { DocumentService } from '../../document/services/document.service';
import { RenderModelBuilderService } from '../../letter-management/shared/services/render-model-builder.service';
import { LetterTemplateRepository } from '../../letter-management/templates/repositories/letter-template.repository';
import { OfferCandidateRepository } from '../repositories/offer-candidate.repository';
import { SignatoryRepository } from '../../letter-management/signatories/repositories/signatory.repository';
import { FolderType } from '../../document/enums/document.enum';
import { Offer } from '../entities/offer.entity';
import { OfferSettings } from '../entities/offer-settings.entity';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import type { RenderModel } from '../../letter-management/shared/interfaces/render-model.interface';

@Injectable()
export class OfferPdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfferPdfService.name);
  private browser: Browser | null = null;

  constructor(
    private readonly pdfBuilder: PdfBuilderService,
    private readonly documentService: DocumentService,
    private readonly templateRepo: LetterTemplateRepository,
    private readonly candidateRepo: OfferCandidateRepository,
    private readonly signatoryRepo: SignatoryRepository,
    private readonly renderModelBuilder: RenderModelBuilderService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Puppeteer browser instance...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async onModuleDestroy() {
    if (this.browser) {
      this.logger.log('Closing Puppeteer browser instance...');
      await this.browser.close();
    }
  }

  async generateAndUploadPdf(
    user: LoggedInUser,
    offer: Offer,
    settings: OfferSettings,
    version: number,
  ): Promise<string> {
    if (offer.custom_letter_html) {
      const pdfBuffer = await this.generateFromHtml(offer.custom_letter_html);
      const file = {
        buffer: pdfBuffer,
        originalname: `Offer_${offer.offer_number ?? 'Draft'}_v${version}.pdf`,
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
      };
      const doc = await this.documentService.uploadDocument(
        user,
        file,
        FolderType.OFFER_DOCUMENT,
      );
      return this.documentService.buildViewUrl(doc);
    }

    const model = await this.buildRenderModel(offer, settings);
    if (!model) return '';

    return this.buildAndUpload(user, model, offer, version, '');
  }

  private async generateFromHtml(html: string): Promise<Buffer> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    const page = await this.browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '40px', bottom: '40px', left: '40px', right: '40px' },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await page.close(); // Close only the page, not the entire browser
    }
  }

  /**
   * Regenerates the offer letter with an "ACCEPTED" watermark and a footer
   * note recording who accepted it and when — this is the candidate's proof
   * of acceptance, stored separately from the original sent PDF (which stays
   * an immutable record of what was offered).
   */
  async generateAcceptedPdf(
    user: LoggedInUser,
    offer: Offer,
    settings: OfferSettings,
    version: number,
    candidateName: string,
    acceptedAt: Date,
  ): Promise<string> {
    if (offer.custom_letter_html) {
      // If it's custom HTML, we need to append the watermark somehow, or just generate without watermark for MVP
      // For MVP, we will just generate the HTML again. A better approach is to append the watermark div to the HTML.
      const watermarkedHtml = `
        ${offer.custom_letter_html}
        
        <!-- Diagonal Watermark -->
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120px; font-weight: bold; color: rgba(34, 197, 94, 0.1); z-index: -1; pointer-events: none; text-align: center; font-family: sans-serif; white-space: nowrap;">
          ACCEPTED
        </div>

        <!-- Digital Signature Footer -->
        <div style="margin-top: 60px; padding-top: 20px; border-top: 2px dashed #e2e8f0; font-family: sans-serif; page-break-inside: avoid;">
          <h3 style="color: #16a34a; margin: 0 0 10px 0; font-size: 16px;">✓ Digitally Accepted</h3>
          <table style="width: 100%; font-size: 12px; color: #475569; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; width: 120px;"><strong>Accepted By:</strong></td>
              <td style="padding: 4px 0;">${candidateName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Date & Time:</strong></td>
              <td style="padding: 4px 0;">${acceptedAt.toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Offer Reference:</strong></td>
              <td style="padding: 4px 0;">${offer.offer_number ?? offer.id}</td>
            </tr>
          </table>
          <p style="margin-top: 16px; font-size: 10px; color: #94a3b8; font-style: italic;">
            This is a system-generated record of digital acceptance. No physical signature is required.
          </p>
        </div>
      `;
      const pdfBuffer = await this.generateFromHtml(watermarkedHtml);
      const file = {
        buffer: pdfBuffer,
        originalname: `Offer_${offer.offer_number ?? 'Draft'}_v${version}_accepted.pdf`,
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
      };
      const doc = await this.documentService.uploadDocument(
        user,
        file,
        FolderType.OFFER_DOCUMENT,
      );
      return this.documentService.buildViewUrl(doc);
    }

    const model = await this.buildRenderModel(offer, settings);
    if (!model) return '';

    model.watermark = {
      label: 'ACCEPTED',
      note: `Digitally accepted by ${candidateName} on ${acceptedAt.toLocaleString('en-IN')}`,
    };

    return this.buildAndUpload(user, model, offer, version, '_accepted');
  }

  private async buildRenderModel(
    offer: Offer,
    settings: OfferSettings,
  ): Promise<RenderModel | null> {
    if (!offer.template_id) return null;

    const template = await this.templateRepo.findOneByOrg(
      offer.template_id,
      offer.organization_id,
    );
    if (!template) return null;

    const candidate = await this.candidateRepo.findById(offer.candidate_id);
    if (!candidate) return null;

    const variables: Record<string, string> = {
      candidate_name: `${candidate.first_name} ${candidate.last_name}`,
      position: offer.position ?? '',
      ctc: offer.ctc_annual?.toString() ?? '',
      joining_date: offer.joining_date
        ? new Date(offer.joining_date).toLocaleDateString()
        : '',
      department: offer.department_id ?? '',
    };

    const sigId = template.signatory_id ?? settings.default_signatory_id;
    let signatoryInfo: any = null;
    if (sigId) {
      const sig = await this.signatoryRepo.findById(sigId);
      if (sig) signatoryInfo = { name: sig.name, designation: sig.designation };
    }

    let salaryTable: any = null;
    if (template.include_salary_table && offer.salary_components?.length > 0) {
      salaryTable = {
        components: offer.salary_components.map((c) => ({
          component_name: c.name,
          amount: c.amount,
        })),
        total: offer.ctc_annual ?? 0,
      };
    }

    return this.renderModelBuilder.build(
      template,
      variables,
      salaryTable,
      signatoryInfo,
    );
  }

  private async buildAndUpload(
    user: LoggedInUser,
    model: RenderModel,
    offer: Offer,
    version: number,
    suffix: string,
  ): Promise<string> {
    const pdfBuffer = await this.pdfBuilder.build(model);

    const file = {
      buffer: pdfBuffer,
      originalname: `Offer_${offer.offer_number ?? 'Draft'}_v${version}${suffix}.pdf`,
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
    };

    const doc = await this.documentService.uploadDocument(
      user,
      file,
      FolderType.OFFER_DOCUMENT,
    );

    return this.documentService.buildViewUrl(doc);
  }
}
