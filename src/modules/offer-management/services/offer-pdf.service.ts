import { Injectable, Logger } from '@nestjs/common';
import { PdfBuilderService } from '../../letter-management/shared/services/pdf-builder.service';
import { DocumentService } from '../../document/services/document.service';
import { OfferTemplateRepository } from '../repositories/offer-template.repository';
import { OfferCandidateRepository } from '../repositories/offer-candidate.repository';
import { SignatoryRepository } from '../../letter-management/signatories/repositories/signatory.repository';
import { FolderType } from '../../document/enums/document.enum';
import { Offer } from '../entities/offer.entity';
import { OfferSettings } from '../entities/offer-settings.entity';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import type { RenderModel } from '../../letter-management/shared/interfaces/render-model.interface';

@Injectable()
export class OfferPdfService {
  private readonly logger = new Logger(OfferPdfService.name);

  constructor(
    private readonly pdfBuilder: PdfBuilderService,
    private readonly documentService: DocumentService,
    private readonly templateRepo: OfferTemplateRepository,
    private readonly candidateRepo: OfferCandidateRepository,
    private readonly signatoryRepo: SignatoryRepository,
  ) {}

  async generateAndUploadPdf(user: LoggedInUser, offer: Offer, settings: OfferSettings, version: number): Promise<string> {
    if (!offer.template_id) return '';

    const template = await this.templateRepo.findById(offer.template_id);
    if (!template || !template.body) return '';

    const candidate = await this.candidateRepo.findById(offer.candidate_id);
    if (!candidate) return '';

    let body = template.body;
    const variables = {
      candidate_name: `${candidate.first_name} ${candidate.last_name}`,
      position: offer.position ?? '',
      ctc: offer.ctc_annual?.toString() ?? '',
      joining_date: offer.joining_date ? new Date(offer.joining_date).toLocaleDateString() : '',
      department: offer.department_id ?? '',
    };

    for (const [key, val] of Object.entries(variables)) {
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), val);
    }

    const paragraphs = body.split('\n\n').map(p => p.trim()).filter(Boolean);

    const sigId = template.signatory_id ?? settings.default_signatory_id;
    let signatoryInfo: any = null;
    if (sigId) {
      const sig = await this.signatoryRepo.findById(sigId);
      if (sig) signatoryInfo = { name: sig.name, designation: sig.designation };
    }

    let salaryTable: any = null;
    if (template.include_salary_table && offer.salary_components?.length > 0) {
      salaryTable = {
        components: offer.salary_components.map(c => ({ component_name: c.name, amount: c.amount })),
        total: offer.ctc_annual ?? 0,
      };
    }

    const model: RenderModel = {
      heading: `Offer Letter - ${variables.position}`,
      paragraphs,
      bulletList: [],
      salaryTable,
      signatory: signatoryInfo,
    };

    const pdfBuffer = await this.pdfBuilder.build(model);

    const file = {
      buffer: pdfBuffer,
      originalname: `Offer_${offer.offer_number ?? 'Draft'}_v${version}.pdf`,
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
    };

    const doc = await this.documentService.uploadDocument(user, file, FolderType.OFFER_DOCUMENT);

    return this.documentService.buildViewUrl(doc);
  }
}
