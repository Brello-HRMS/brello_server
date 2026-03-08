import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { UserBankInfo } from '../entities/user-bank-info.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class UserBankInfoRepository {
  constructor(
    @InjectRepository(UserBankInfo)
    private readonly repository: Repository<UserBankInfo>,
  ) {}

  async upsert(bankInfo: Partial<UserBankInfo>): Promise<UserBankInfo> {
    // Check if bank info exists for the user profile ID first
    const existing = await this.repository.findOne({
      where: { user_profile_id: bankInfo.user_profile_id },
    });

    if (existing) {
      await this.repository.update(existing.id, bankInfo);
      return this.repository.findOne({
        where: { id: existing.id },
      }) as Promise<UserBankInfo>;
    }

    const newBankInfo = this.repository.create(bankInfo);
    return this.repository.save(newBankInfo);
  }

  async findByProfileId(profileId: string): Promise<UserBankInfo | null> {
    return this.repository.findOne({
      where: { user_profile_id: profileId, status: Not(Status.DELETED) },
    });
  }
}
