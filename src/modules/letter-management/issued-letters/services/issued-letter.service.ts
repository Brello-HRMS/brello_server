import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IssuedLetterRepository } from '../repositories/issued-letter.repository';
import { IssuedLetter } from '../entities/issued-letter.entity';
import { LetterTemplateRepository } from '../../templates/repositories/letter-template.repository';
import { VariableResolverService } from '../../shared/services/variable-resolver.service';
import { RenderModelBuilderService } from '../../shared/services/render-model-builder.service';
import { PdfBuilderService } from '../../shared/services/pdf-builder.service';
import { NumberingService } from '../../shared/services/numbering.service';
import { DocumentService } from '../../../document/services/document.service';
import { FolderType } from '../../../document/enums/document.enum';
import { NotificationService } from '../../../notification/services/notification.service';
import { NotificationType } from '../../../../common/enums/notification-type.enum';
import { AUDIT_SERVICE_TOKEN } from '../../../audit/interfaces/audit-service.interface';
import type { IAuditService } from '../../../audit/interfaces/audit-service.interface';
import { AuditLogModule } from '../../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../../audit/enums/audit-action.enum';
import { EmployeeService } from '../../../user/services/employee.service';
import type { LoggedInUser } from '../../../auth/interfaces/logged-in-user.interface';
import {
  GenerateIssuedLetterDto,
  ResolveIssuedLetterDto,
  IssuedLetterFiltersDto,
} from '../dto/issued-letter.dto';

const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class IssuedLetterService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly issuedLetterRepository: IssuedLetterRepository,
    private readonly templateRepository: LetterTemplateRepository,
    private readonly variableResolver: VariableResolverService,
    private readonly renderModelBuilder: RenderModelBuilderService,
    private readonly pdfBuilder: PdfBuilderService,
    private readonly numberingService: NumberingService,
    private readonly documentService: DocumentService,
    private readonly notificationService: NotificationService,
    private readonly employeeService: EmployeeService,
    @Inject(AUDIT_SERVICE_TOKEN) private readonly auditService: IAuditService,
  ) {}

  async searchEmployees(user: LoggedInUser) {
    return this.employeeService.getDropdown(user);
  }

  /** Dry-run: resolves variables + builds the render model. No writes, no number reservation. */
  async resolve(user: LoggedInUser, dto: ResolveIssuedLetterDto) {
    const template = await this.templateRepository.findPublishedByOrg(
      dto.template_id,
      user.organizationId,
    );
    if (!template) {
      throw new NotFoundException('Template not found or not published');
    }

    const { values, missing } = await this.variableResolver.resolve(user, dto.employee_id);
    const salaryTable = template.include_salary_table
      ? await this.variableResolver.getSalaryTable(dto.employee_id)
      : null;
    const signatory = await this.variableResolver.getSignatory(
      user.organizationId,
      template.signatory_id,
    );

    const preview = this.renderModelBuilder.build(template, values, salaryTable, signatory);

    return { values, missing, preview };
  }

  async generate(
    user: LoggedInUser,
    dto: GenerateIssuedLetterDto,
    idempotencyKey?: string,
  ): Promise<{ letterId: string; letterNumber: string; downloadUrl: string }> {
    if (idempotencyKey) {
      const existing = await this.issuedLetterRepository.findByIdempotencyKey(
        user.organizationId,
        idempotencyKey,
      );
      if (existing && Date.now() - existing.created_at.getTime() < IDEMPOTENCY_WINDOW_MS) {
        return this.toGenerateResponse(user, existing);
      }
    }

    const template = await this.templateRepository.findPublishedByOrg(
      dto.template_id,
      user.organizationId,
    );
    if (!template) {
      throw new NotFoundException('Template not found or not published');
    }

    const { values, missing } = await this.variableResolver.resolve(user, dto.employee_id);
    const merged = { ...values, ...(dto.manual_values ?? {}) };
    const stillMissing = missing.filter((key) => !merged[key]?.trim());
    if (stillMissing.length > 0) {
      throw new BadRequestException(
        `Missing required variable(s): ${stillMissing.join(', ')}`,
      );
    }

    const salaryTable = template.include_salary_table
      ? await this.variableResolver.getSalaryTable(dto.employee_id)
      : null;
    const signatory = await this.variableResolver.getSignatory(
      user.organizationId,
      template.signatory_id,
    );

    const issuedLetter = await this.dataSource.transaction(async (manager) => {
      const letterNumber = await this.numberingService.reserveNumber(user, manager);
      merged.letter_number = letterNumber;

      const renderModel = this.renderModelBuilder.build(template, merged, salaryTable, signatory);
      const pdfBuffer = await this.pdfBuilder.build(renderModel);

      // Upload happens inside this transaction for simplicity; if the final
      // insert below fails, the uploaded PDF is orphaned in storage (harmless
      // clutter, not a correctness issue — the DB row is what defines whether
      // a letter was legally issued).
      const document = await this.documentService.uploadDocument(
        user,
        {
          buffer: pdfBuffer,
          originalname: `${letterNumber}.pdf`,
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
        },
        FolderType.LETTER_DOCUMENT,
        dto.employee_id,
      );

      return this.issuedLetterRepository.createWithManager(
        {
          organization_id: user.organizationId,
          enterprise_id: user.enterpriseId,
          employee_id: dto.employee_id,
          template_id: template.id,
          template_version: template.version,
          category_id: template.category_id,
          letter_number: letterNumber,
          title: template.name,
          variable_snapshot: merged,
          heading_snapshot: renderModel.heading,
          paragraphs_snapshot: renderModel.paragraphs,
          bullets_snapshot: renderModel.bulletList,
          salary_snapshot: renderModel.salaryTable,
          signatory_snapshot: renderModel.signatory,
          pdf_document_id: document.id,
          generated_by: user.userId,
          generated_at: new Date(),
          idempotency_key: idempotencyKey ?? null,
        },
        manager,
      );
    });

    // Fire-and-forget — never let notification failures affect the response.
    this.notificationService
      .send({
        user_id: dto.employee_id,
        title: `${template.name} Generated`,
        message: `Your ${template.name} is available for download.`,
        type: NotificationType.IN_APP,
      })
      .catch(() => {});

    void this.auditService.log({
      actor_id: user.userId,
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      is_platform_admin: user.isPlatformAdmin,
      module: AuditLogModule.LETTER_MANAGEMENT,
      action: AuditAction.GENERATE,
      entity_type: 'issued_letter',
      entity_id: issuedLetter.id,
      entity_display_name: issuedLetter.letter_number,
      new_value: {
        employee_id: dto.employee_id,
        template_id: template.id,
        category_id: template.category_id,
        letter_number: issuedLetter.letter_number,
      },
    });

    return this.toGenerateResponse(user, issuedLetter);
  }

  private async toGenerateResponse(user: LoggedInUser, letter: IssuedLetter) {
    const { url } = await this.documentService.getSignedUrl(letter.pdf_document_id, user);
    return { letterId: letter.id, letterNumber: letter.letter_number, downloadUrl: url };
  }

  async findAll(user: LoggedInUser, filters?: IssuedLetterFiltersDto): Promise<IssuedLetter[]> {
    return this.issuedLetterRepository.findByOrgWithFilters(user.organizationId, filters);
  }

  async findOne(user: LoggedInUser, id: string): Promise<IssuedLetter> {
    const letter = await this.issuedLetterRepository.findById(id, user.organizationId);
    if (!letter) throw new NotFoundException(`Issued letter "${id}" not found`);
    return letter;
  }

  async download(user: LoggedInUser, id: string): Promise<{ url: string }> {
    const letter = await this.findOne(user, id);
    return this.documentService.getSignedUrl(letter.pdf_document_id, user);
  }

  async findMine(user: LoggedInUser): Promise<IssuedLetter[]> {
    return this.issuedLetterRepository.findByEmployee(user.organizationId, user.userId);
  }

  async findMineById(user: LoggedInUser, id: string): Promise<IssuedLetter> {
    const letter = await this.issuedLetterRepository.findByIdForEmployee(
      id,
      user.organizationId,
      user.userId,
    );
    if (!letter) throw new NotFoundException(`Letter "${id}" not found`);
    return letter;
  }

  async downloadMine(user: LoggedInUser, id: string): Promise<{ url: string }> {
    const letter = await this.findMineById(user, id);
    return this.documentService.getSignedUrl(letter.pdf_document_id, user);
  }
}
