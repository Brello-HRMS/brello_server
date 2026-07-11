import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ReimbursementRepository } from '../repositories/reimbursement.repository';
import { CreateReimbursementDto } from '../dto/create-reimbursement.dto';
import { UpdateReimbursementDto } from '../dto/update-reimbursement.dto';
import { EmployeeReimbursementQueryDto } from '../dto/employee-query.dto';
import { ReimbursementStatus } from '../enums/reimbursement.enum';
import { SearchIndexingService } from '../../global-search/services/search-indexing.service';
import { AuditContextService } from '../../audit/services/audit-context.service';
import { Document } from '../../document/entities/document.entity';

@Injectable()
export class ReimbursementService {
  constructor(
    private readonly reimbursementRepository: ReimbursementRepository,
    private readonly searchIndexingService: SearchIndexingService,
    private readonly auditContext: AuditContextService,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
  ) {}

  /**
   * Prevents attaching another tenant's/employee's document to a claim by
   * guessed/reused document id — every attachment must belong to the
   * submitting employee, in their own org.
   */
  private async assertDocumentsOwnedByEmployee(
    documentIds: string[],
    userId: string,
    orgId: string,
  ): Promise<void> {
    if (documentIds.length === 0) return;

    const documents = await this.documentRepo.findBy({ id: In(documentIds) });
    const foundIds = new Set(documents.map((d) => d.id));
    const missing = documentIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Document(s) not found: ${missing.join(', ')}`);
    }

    const unauthorized = documents.some(
      (d) => d.organization_id !== orgId || d.employee_id !== userId,
    );
    if (unauthorized) {
      throw new ForbiddenException('One or more attachments do not belong to you.');
    }
  }

  async create(
    userId: string,
    enterpriseId: string,
    orgId: string,
    dto: CreateReimbursementDto,
  ) {
    if (!dto.document_ids || dto.document_ids.length === 0) {
      throw new BadRequestException('At least one attachment is required.');
    }

    const expenseDate = new Date(dto.expense_date);
    if (expenseDate > new Date()) {
      throw new BadRequestException('Expense date cannot be in the future.');
    }

    await this.assertDocumentsOwnedByEmployee(dto.document_ids, userId, orgId);

    const reimbursement = await this.reimbursementRepository.createWithAttachments(
      {
        employee_id: userId,
        enterprise_id: enterpriseId,
        organization_id: orgId,
        title: dto.title,
        expense_description: dto.expense_description,
        expense_date: expenseDate,
        amount: dto.amount,
        created_by: userId,
      },
      dto.document_ids,
    );

    this.searchIndexingService.indexReimbursement(reimbursement, enterpriseId, orgId);
    return reimbursement;
  }

  async findMine(
    userId: string,
    enterpriseId: string,
    orgId: string,
    query: EmployeeReimbursementQueryDto,
  ) {
    const [items, total] = await this.reimbursementRepository.findByEmployee(
      userId,
      enterpriseId,
      orgId,
      query,
    );

    return {
      items,
      pagination: {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        total,
      },
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateReimbursementDto,
  ) {
    const reimbursement = await this.reimbursementRepository.findById(id);

    if (!reimbursement) throw new NotFoundException('Reimbursement not found.');
    if (reimbursement.employee_id !== userId) throw new ForbiddenException('Access denied.');
    if (reimbursement.reimb_status !== ReimbursementStatus.PENDING) {
      throw new ConflictException('Only pending reimbursements can be edited.');
    }
    if (reimbursement.version !== dto.version) {
      throw new ConflictException('Version mismatch. Please refresh and try again.');
    }
    this.auditContext.setPreValue(reimbursement as unknown as Record<string, unknown>);

    const changes: any = {};
    if (dto.title) changes.title = dto.title;
    if (dto.expense_description !== undefined) changes.expense_description = dto.expense_description;
    if (dto.expense_date) {
      const expDate = new Date(dto.expense_date);
      if (expDate > new Date()) throw new BadRequestException('Expense date cannot be in the future.');
      changes.expense_date = expDate;
    }
    if (dto.amount) changes.amount = dto.amount;

    await this.assertDocumentsOwnedByEmployee(
      dto.add_document_ids ?? [],
      userId,
      reimbursement.organization_id,
    );

    const updated = await this.reimbursementRepository.updateWithAttachments(
      reimbursement,
      changes,
      dto.add_document_ids ?? [],
      dto.remove_document_ids ?? [],
      userId,
    );
    this.searchIndexingService.indexReimbursement(
      updated,
      reimbursement.enterprise_id,
      reimbursement.organization_id,
    );
    return updated;
  }

  async remove(userId: string, id: string) {
    const reimbursement = await this.reimbursementRepository.findById(id);

    if (!reimbursement) throw new NotFoundException('Reimbursement not found.');
    if (reimbursement.employee_id !== userId) throw new ForbiddenException('Access denied.');
    if (reimbursement.reimb_status !== ReimbursementStatus.PENDING) {
      throw new ConflictException('Only pending reimbursements can be deleted.');
    }

    this.auditContext.setPreValue(reimbursement as unknown as Record<string, unknown>);
    await this.reimbursementRepository.softDelete(reimbursement, userId);
    this.searchIndexingService.removeReimbursement(id, reimbursement.enterprise_id);
    return { success: true };
  }
}
