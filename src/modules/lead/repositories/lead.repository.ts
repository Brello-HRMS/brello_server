import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../entities/lead.entity';

@Injectable()
export class LeadRepository {
  constructor(
    @InjectRepository(Lead)
    private readonly repository: Repository<Lead>,
  ) {}

  async create(data: Partial<Lead>): Promise<Lead> {
    const lead = this.repository.create(data);
    return this.repository.save(lead);
  }

  async findByEmail(email: string): Promise<Lead | null> {
    return this.repository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<Lead | null> {
    return this.repository.findOne({ where: { id } });
  }

  async update(id: string, data: Partial<Lead>): Promise<Lead | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async emailExists(email: string): Promise<boolean> {
    const count = await this.repository.count({ where: { email } });
    return count > 0;
  }

  async phoneExists(phone: string): Promise<boolean> {
    const count = await this.repository.count({ where: { phone } });
    return count > 0;
  }
}
