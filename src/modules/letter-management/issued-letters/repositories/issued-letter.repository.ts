import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { IssuedLetter } from '../entities/issued-letter.entity';
import { IssuedLetterFiltersDto } from '../dto/issued-letter.dto';
import { IssuedLetterDeliveryStatus } from '../enums/issued-letter-delivery-status.enum';

/**
 * Deliberately exposes no general update/delete methods — issued letters are
 * immutable legal records. Enforce that invariant at this API surface, not
 * just by convention. `markViewed`/`acknowledge` below are the one narrow,
 * purpose-built exception for the recipient's delivery lifecycle.
 */
@Injectable()
export class IssuedLetterRepository {
  constructor(
    @InjectRepository(IssuedLetter)
    private readonly repo: Repository<IssuedLetter>,
  ) {}

  async createWithManager(
    data: Partial<IssuedLetter>,
    manager: EntityManager,
  ): Promise<IssuedLetter> {
    return manager.save(manager.create(IssuedLetter, data));
  }

  async findById(id: string, organizationId: string): Promise<IssuedLetter | null> {
    return this.repo.findOne({ where: { id, organization_id: organizationId } });
  }

  async findByIdempotencyKey(
    organizationId: string,
    idempotencyKey: string,
  ): Promise<IssuedLetter | null> {
    return this.repo.findOne({
      where: { organization_id: organizationId, idempotency_key: idempotencyKey },
    });
  }

  async findByOrgWithFilters(
    organizationId: string,
    filters: IssuedLetterFiltersDto = {},
  ): Promise<IssuedLetter[]> {
    const {
      employee_id,
      category_id,
      template_id,
      letter_number,
      date_from,
      date_to,
      delivery_status,
    } = filters;

    const qb = this.repo
      .createQueryBuilder('letter')
      .where('letter.organization_id = :organizationId', { organizationId });

    if (employee_id) qb.andWhere('letter.employee_id = :employee_id', { employee_id });
    if (category_id) qb.andWhere('letter.category_id = :category_id', { category_id });
    if (template_id) qb.andWhere('letter.template_id = :template_id', { template_id });
    if (letter_number) {
      qb.andWhere('letter.letter_number ILIKE :letter_number', {
        letter_number: `%${letter_number}%`,
      });
    }
    if (date_from) qb.andWhere('letter.generated_at >= :date_from', { date_from });
    if (date_to) qb.andWhere('letter.generated_at <= :date_to', { date_to });
    if (delivery_status) qb.andWhere('letter.delivery_status = :delivery_status', { delivery_status });

    qb.orderBy('letter.generated_at', 'DESC');

    return qb.getMany();
  }

  async findByEmployee(organizationId: string, employeeId: string): Promise<IssuedLetter[]> {
    return this.repo.find({
      where: { organization_id: organizationId, employee_id: employeeId },
      order: { generated_at: 'DESC' },
    });
  }

  async findByIdForEmployee(
    id: string,
    organizationId: string,
    employeeId: string,
  ): Promise<IssuedLetter | null> {
    return this.repo.findOne({
      where: { id, organization_id: organizationId, employee_id: employeeId },
    });
  }

  /** No-op if the letter is no longer ISSUED (idempotent, guards races). */
  async markViewed(id: string, organizationId: string): Promise<void> {
    await this.repo.update(
      {
        id,
        organization_id: organizationId,
        delivery_status: IssuedLetterDeliveryStatus.ISSUED,
      },
      { delivery_status: IssuedLetterDeliveryStatus.VIEWED, viewed_at: new Date() },
    );
  }

  /** Backfills viewed_at if the letter is acknowledged directly from ISSUED. */
  async acknowledge(id: string, organizationId: string): Promise<void> {
    const now = new Date();
    await this.repo
      .createQueryBuilder()
      .update(IssuedLetter)
      .set({
        delivery_status: IssuedLetterDeliveryStatus.ACKNOWLEDGED,
        acknowledged_at: now,
        viewed_at: () => 'COALESCE(viewed_at, :now)',
      })
      .setParameter('now', now)
      .where('id = :id AND organization_id = :organizationId', { id, organizationId })
      .execute();
  }
}
