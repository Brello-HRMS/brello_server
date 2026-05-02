import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Reimbursement } from '../entities/reimbursement.entity';
import { ReimbursementAttachment } from '../entities/reimbursement-attachment.entity';
import { ReimbursementAuditLog } from '../entities/reimbursement-audit-log.entity';
import { ReimbursementStatus, AuditAction } from '../enums/reimbursement.enum';
import { AdminReimbursementQueryDto } from '../dto/admin-query.dto';
import { EmployeeReimbursementQueryDto } from '../dto/employee-query.dto';
import { Document } from '../../document/entities/document.entity';

@Injectable()
export class ReimbursementRepository {
  constructor(
    @InjectRepository(Reimbursement)
    private readonly repo: Repository<Reimbursement>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<Reimbursement | null> {
    return this.repo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['attachments'],
    });
  }

  async findByEmployee(
    userId: string,
    enterpriseId: string,
    orgId: string,
    query: EmployeeReimbursementQueryDto,
  ): Promise<[Reimbursement[], number]> {
    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.attachments', 'att')
      .where('r.employee_id = :userId', { userId })
      .andWhere('r.enterprise_id = :enterpriseId', { enterpriseId })
      .andWhere('r.organization_id = :orgId', { orgId })
      .andWhere('r.deleted_at IS NULL');

    if (query.status) qb.andWhere('r.reimb_status = :status', { status: query.status });
    if (query.is_paid !== undefined) qb.andWhere('r.is_paid = :is_paid', { is_paid: query.is_paid });
    if (query.from_date) qb.andWhere('r.expense_date >= :from_date', { from_date: query.from_date });
    if (query.to_date) qb.andWhere('r.expense_date <= :to_date', { to_date: query.to_date });

    const sort = query.sort === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy('r.created_at', sort);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    return qb.getManyAndCount();
  }

  async findAll(
    enterpriseId: string,
    orgId: string,
    query: AdminReimbursementQueryDto,
  ): Promise<[Reimbursement[], number]> {
    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.attachments', 'att')
      .where('r.enterprise_id = :enterpriseId', { enterpriseId })
      .andWhere('r.organization_id = :orgId', { orgId })
      .andWhere('r.deleted_at IS NULL');

    if (query.employee_id) qb.andWhere('r.employee_id = :employee_id', { employee_id: query.employee_id });
    if (query.status) qb.andWhere('r.reimb_status = :status', { status: query.status });
    if (query.is_paid !== undefined) qb.andWhere('r.is_paid = :is_paid', { is_paid: query.is_paid });
    if (query.from_date) qb.andWhere('r.expense_date >= :from_date', { from_date: query.from_date });
    if (query.to_date) qb.andWhere('r.expense_date <= :to_date', { to_date: query.to_date });

    const sort = query.sort === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy('r.created_at', sort);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    return qb.getManyAndCount();
  }

  async createWithAttachments(data: Partial<Reimbursement>, documentIds: string[]): Promise<Reimbursement> {
    return this.dataSource.transaction(async (manager) => {
      const reimbursement = manager.create(Reimbursement, {
        ...data,
        reimb_status: ReimbursementStatus.PENDING,
        is_paid: false,
        version: 1,
      });
      const saved = await manager.save(Reimbursement, reimbursement);

      if (documentIds.length > 0) {
        const attachments = documentIds.map((docId) =>
          manager.create(ReimbursementAttachment, {
            reimbursement_id: saved.id,
            document_id: docId,
          }),
        );
        await manager.save(ReimbursementAttachment, attachments);
      }

      await manager.save(ReimbursementAuditLog, manager.create(ReimbursementAuditLog, {
        reimbursement_id: saved.id,
        action: AuditAction.CREATED,
        new_data: { status: ReimbursementStatus.PENDING, amount: saved.amount },
        performed_by: saved.created_by,
      }));

      return saved;
    });
  }

  async updateWithAttachments(
    reimbursement: Reimbursement,
    changes: Partial<Reimbursement>,
    addDocIds: string[],
    removeDocIds: string[],
    actorId: string,
  ): Promise<Reimbursement> {
    return this.dataSource.transaction(async (manager) => {
      const oldData = {
        title: reimbursement.title,
        amount: reimbursement.amount,
        expense_date: reimbursement.expense_date,
      };

      Object.assign(reimbursement, changes);
      reimbursement.version += 1;
      const saved = await manager.save(Reimbursement, reimbursement);

      if (removeDocIds.length > 0) {
        await manager.delete(ReimbursementAttachment, {
          reimbursement_id: saved.id,
          document_id: In(removeDocIds),
        });
      }
      if (addDocIds.length > 0) {
        const newAttachments = addDocIds.map((docId) =>
          manager.create(ReimbursementAttachment, {
            reimbursement_id: saved.id,
            document_id: docId,
          }),
        );
        await manager.save(ReimbursementAttachment, newAttachments);
      }

      await manager.save(ReimbursementAuditLog, manager.create(ReimbursementAuditLog, {
        reimbursement_id: saved.id,
        action: AuditAction.UPDATED,
        old_data: oldData,
        new_data: { title: saved.title, amount: saved.amount, expense_date: saved.expense_date },
        performed_by: actorId,
      }));

      return saved;
    });
  }

  async softDelete(reimbursement: Reimbursement, actorId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      reimbursement.deleted_at = new Date();
      reimbursement.deleted_by = actorId;
      await manager.save(Reimbursement, reimbursement);

      await manager.save(ReimbursementAuditLog, manager.create(ReimbursementAuditLog, {
        reimbursement_id: reimbursement.id,
        action: AuditAction.DELETED,
        old_data: { status: reimbursement.reimb_status },
        new_data: { deleted: true },
        performed_by: actorId,
      }));
    });
  }

  async updateStatus(
    reimbursement: Reimbursement,
    status: ReimbursementStatus,
    rejectionReason: string | undefined,
    adminId: string,
  ): Promise<Reimbursement> {
    return this.dataSource.transaction(async (manager) => {
      const oldStatus = reimbursement.reimb_status;
      reimbursement.reimb_status = status;
      if (status === ReimbursementStatus.APPROVED) {
        reimbursement.approved_by = adminId;
        reimbursement.approved_at = new Date();
      }
      if (status === ReimbursementStatus.REJECTED) {
        reimbursement.rejection_reason = rejectionReason ?? null;
      }
      const saved = await manager.save(Reimbursement, reimbursement);

      const action = status === ReimbursementStatus.APPROVED ? AuditAction.APPROVED : AuditAction.REJECTED;
      await manager.save(ReimbursementAuditLog, manager.create(ReimbursementAuditLog, {
        reimbursement_id: saved.id,
        action,
        old_data: { status: oldStatus },
        new_data: { status, rejection_reason: rejectionReason },
        performed_by: adminId,
      }));

      return saved;
    });
  }

  async markPaid(reimbursement: Reimbursement, adminId: string): Promise<Reimbursement> {
    return this.dataSource.transaction(async (manager) => {
      reimbursement.is_paid = true;
      reimbursement.paid_at = new Date();
      const saved = await manager.save(Reimbursement, reimbursement);

      await manager.save(ReimbursementAuditLog, manager.create(ReimbursementAuditLog, {
        reimbursement_id: saved.id,
        action: AuditAction.PAID,
        old_data: { is_paid: false },
        new_data: { is_paid: true, paid_at: saved.paid_at },
        performed_by: adminId,
      }));

      return saved;
    });
  }

  async getDocumentSignedUrls(documentIds: string[]): Promise<Record<string, string>> {
    if (documentIds.length === 0) return {};
    const docs = await this.documentRepo.findBy({ id: In(documentIds) });
    const result: Record<string, string> = {};
    for (const doc of docs) {
      result[doc.id] = doc.object_key;
    }
    return result;
  }
}
