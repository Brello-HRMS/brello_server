import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { IndustryType } from '../entities/industry-type.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class IndustryTypeRepository {
  constructor(
    @InjectRepository(IndustryType)
    private readonly repository: Repository<IndustryType>,
  ) {}

  async create(industryTypeData: Partial<IndustryType>): Promise<IndustryType> {
    const newIndustryType = this.repository.create(industryTypeData);
    return this.repository.save(newIndustryType);
  }

  async findAll(): Promise<IndustryType[]> {
    return this.repository.find({
      where: { status: Not(Status.DELETED) },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<IndustryType | null> {
    return this.repository.findOne({
      where: { id, status: Not(Status.DELETED) },
    });
  }

  async findByName(name: string): Promise<IndustryType | null> {
    return this.repository.findOne({
      where: { name, status: Not(Status.DELETED) },
    });
  }

  async update(
    id: string,
    updateData: Partial<IndustryType>,
  ): Promise<IndustryType | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      status: Status.DELETED,
    });
    return (result.affected ?? 0) > 0;
  }

  async countOrgsUsing(id: string): Promise<number> {
    const result = await this.repository.manager.query(
      'SELECT COUNT(*) FROM organization_profile WHERE industry_type_id = $1',
      [id],
    );
    return parseInt(result[0].count, 10);
  }
}
