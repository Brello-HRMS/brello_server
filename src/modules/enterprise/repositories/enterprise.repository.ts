import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enterprise } from '../entities/enterprise.entity';

@Injectable()
export class EnterpriseRepository {
  constructor(
    @InjectRepository(Enterprise)
    private readonly repository: Repository<Enterprise>,
  ) {}

  async create(enterprise: Partial<Enterprise>): Promise<Enterprise> {
    const newEnterprise = this.repository.create(enterprise);
    return this.repository.save(newEnterprise);
  }

  async findAll(): Promise<Enterprise[]> {
    return this.repository.find({
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<Enterprise | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByDomain(domain: string): Promise<Enterprise | null> {
    return this.repository.findOne({ where: { domain } });
  }

  async update(
    id: string,
    updateData: Partial<Enterprise>,
  ): Promise<Enterprise | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
