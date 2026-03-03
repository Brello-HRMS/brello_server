import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enterprise } from '../entities/enterprise.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class EnterpriseRepository {
  constructor(
    @InjectRepository(Enterprise)
    private readonly repository: Repository<Enterprise>,
  ) {}

  create(data: Partial<Enterprise>): Enterprise {
    return this.repository.create(data);
  }

  async save(enterprise: Enterprise): Promise<Enterprise> {
    return this.repository.save(enterprise);
  }

  async findAll(): Promise<Enterprise[]> {
    return this.repository.find({
      where: { base_status: Status.ACTIVE },
      order: { created_at: 'DESC' },
    });
  }

  async findOneById(id: string): Promise<Enterprise | null> {
    return this.repository.findOne({
      where: { id, base_status: Status.ACTIVE },
    });
  }

  async findByDomain(domain: string): Promise<Enterprise | null> {
    return this.repository.findOne({
      where: { domain, base_status: Status.ACTIVE },
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      base_status: Status.DELETED,
      deleted_at: new Date(),
    });
    return (result.affected ?? 0) > 0;
  }
}
