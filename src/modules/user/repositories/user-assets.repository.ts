import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { UserAssets } from '../entities/user-assets.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class UserAssetsRepository {
  constructor(
    @InjectRepository(UserAssets)
    private readonly repository: Repository<UserAssets>,
  ) {}

  async create(asset: Partial<UserAssets>): Promise<UserAssets> {
    const newAsset = this.repository.create(asset);
    return this.repository.save(newAsset);
  }

  async findById(id: string): Promise<UserAssets | null> {
    return this.repository.findOne({
      where: { id, status: Not(Status.DELETED) },
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      status: Status.DELETED,
    });
    return (result.affected ?? 0) > 0;
  }
}
