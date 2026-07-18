import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Document } from '../entities/document.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class DocumentRepository {
  constructor(
    @InjectRepository(Document)
    private readonly repository: Repository<Document>,
  ) {}

  async create(documentData: Partial<Document>): Promise<Document> {
    const newDoc = this.repository.create(documentData);
    return this.repository.save(newDoc);
  }

  async findById(id: string): Promise<Document | null> {
    return this.repository.findOne({
      where: { id, status: Not(Status.DELETED) },
    });
  }

  async findByIdWithContent(id: string): Promise<Document | null> {
    return this.repository.findOne({
      where: { id, status: Not(Status.DELETED) },
      select: [
        'id',
        'enterprise_id',
        'organization_id',
        'is_public',
        'folder_type',
        'file_data',
        'mime_type',
        'original_name',
        'storage_provider',
      ],
    });
  }

  async update(
    id: string,
    updateData: Partial<Document>,
  ): Promise<Document | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }
}
