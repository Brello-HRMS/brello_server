import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { UserDocument } from '../entities/user-document.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class UserDocumentRepository {
  constructor(
    @InjectRepository(UserDocument)
    private readonly repository: Repository<UserDocument>,
  ) {}

  async create(doc: Partial<UserDocument>): Promise<UserDocument> {
    const newDoc = this.repository.create(doc);
    return this.repository.save(newDoc);
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.repository.findOne({
      where: { id, base_status: Not(Status.DELETED) },
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      base_status: Status.DELETED,
    });
    return (result.affected ?? 0) > 0;
  }
}
