import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingProfile } from '../entities/billing-profile.entity';
import { Status } from 'src/common/enums';

@Injectable()
export class BillingProfileRepository {
  constructor(
    @InjectRepository(BillingProfile)
    private readonly repository: Repository<BillingProfile>,
  ) {}

  create(data: Partial<BillingProfile>): BillingProfile {
    return this.repository.create(data);
  }

  save(profile: BillingProfile): Promise<BillingProfile> {
    return this.repository.save(profile);
  }

  findByOrg(organizationId: string): Promise<BillingProfile | null> {
    return this.repository.findOne({
      where: { organization_id: organizationId, status: Status.ACTIVE },
    });
  }
}
