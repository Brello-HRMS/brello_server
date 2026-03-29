import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Client } from '../entities/client.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class ClientRepository {
  constructor(
    @InjectRepository(Client)
    private readonly repository: Repository<Client>,
  ) {}

  async create(data: Partial<Client>): Promise<Client> {
    const client = this.repository.create(data);
    return this.repository.save(client);
  }

  getQueryBuilder(alias: string = 'client'): SelectQueryBuilder<Client> {
    return this.repository.createQueryBuilder(alias);
  }

  async findById(id: string): Promise<Client | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['projects'],
    });
  }

  async findOne(options: any): Promise<Client | null> {
    return this.repository.findOne(options);
  }

  async update(id: string, data: Partial<Client>): Promise<Client | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
