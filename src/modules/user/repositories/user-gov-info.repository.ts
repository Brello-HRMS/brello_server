import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { UserGovInfo } from '../entities/user-gov-info.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class UserGovInfoRepository {
  constructor(
    @InjectRepository(UserGovInfo)
    private readonly repository: Repository<UserGovInfo>,
  ) {}

  async upsert(govInfo: Partial<UserGovInfo>): Promise<UserGovInfo> {
    // Check if gov info exists for the user profile ID first
    const existing = await this.repository.findOne({
      where: { user_profile_id: govInfo.user_profile_id },
    });

    if (existing) {
      await this.repository.update(existing.id, govInfo);
      return this.repository.findOne({
        where: { id: existing.id },
      }) as Promise<UserGovInfo>;
    }

    const newGovInfo = this.repository.create(govInfo);
    return this.repository.save(newGovInfo);
  }

  async findByProfileId(profileId: string): Promise<UserGovInfo | null> {
    return this.repository.findOne({
      where: { user_profile_id: profileId, status: Not(Status.DELETED) },
    });
  }
}
