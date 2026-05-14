import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ReimbursementRepository } from '../repositories/reimbursement.repository';
import { CreateReimbursementDto } from '../dto/create-reimbursement.dto';
import { UpdateReimbursementDto } from '../dto/update-reimbursement.dto';
import { EmployeeReimbursementQueryDto } from '../dto/employee-query.dto';
import { ReimbursementStatus } from '../enums/reimbursement.enum';
import { SearchIndexingService } from '../../global-search/services/search-indexing.service';

@Injectable()
export class ReimbursementService {
  constructor(
    private readonly reimbursementRepository: ReimbursementRepository,
    private readonly searchIndexingService: SearchIndexingService,
  ) {}

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

    const changes: any = {};
    if (dto.title) changes.title = dto.title;
    if (dto.expense_description !== undefined) changes.expense_description = dto.expense_description;
    if (dto.expense_date) {
      const expDate = new Date(dto.expense_date);
      if (expDate > new Date()) throw new BadRequestException('Expense date cannot be in the future.');
      changes.expense_date = expDate;
    }
    if (dto.amount) changes.amount = dto.amount;

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

    await this.reimbursementRepository.softDelete(reimbursement, userId);
    this.searchIndexingService.removeReimbursement(id, reimbursement.enterprise_id);
    return { success: true };
  }
}
