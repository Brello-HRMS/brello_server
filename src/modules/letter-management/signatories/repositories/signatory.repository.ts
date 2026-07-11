import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Signatory } from '../entities/signatory.entity';
import { Status } from '../../../../common/enums';

@Injectable()
export class SignatoryRepository {
  constructor(
    @InjectRepository(Signatory)
    private readonly repo: Repository<Signatory>,
  ) {}

  async create(data: Partial<Signatory>): Promise<Signatory> {
    const signatory = this.repo.create(data);
    return this.repo.save(signatory);
  }

  async findAllByOrg(
    organizationId: string,
    filters: { status?: Status; search?: string } = {},
  ): Promise<Signatory[]> {
    const { status, search } = filters;

    const queryBuilder = this.repo
      .createQueryBuilder('signatory')
      .where('signatory.organization_id = :organizationId', { organizationId });

    if (status) {
      queryBuilder.andWhere('signatory.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere('signatory.name ILIKE :search', { search: `%${search}%` });
    }

    queryBuilder.orderBy('signatory.name', 'ASC');

    return queryBuilder.getMany();
  }

  async findOneByOrg(id: string, organizationId: string): Promise<Signatory | null> {
    return this.repo.findOne({
      where: {
        id,
        organization_id: organizationId,
      },
    });
  }

  async update(id: string, data: Partial<Signatory>): Promise<Signatory | null> {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  async findDefaultForOrg(organizationId: string): Promise<Signatory | null> {
    return this.repo.findOne({
      where: {
        organization_id: organizationId,
        is_default: true,
        status: Status.ACTIVE,
      },
    });
  }

  /**
   * Bulk-clears the `is_default` flag for every signatory in the org,
   * optionally excluding one id (typically the record about to become
   * the new default).
   */
  async clearDefaultForOrg(organizationId: string, exceptId?: string): Promise<void> {
    const queryBuilder = this.repo
      .createQueryBuilder()
      .update(Signatory)
      .set({ is_default: false })
      .where('organization_id = :organizationId', { organizationId })
      .andWhere('is_default = :isDefault', { isDefault: true });

    if (exceptId) {
      queryBuilder.andWhere('id != :exceptId', { exceptId });
    }

    await queryBuilder.execute();
  }
}
