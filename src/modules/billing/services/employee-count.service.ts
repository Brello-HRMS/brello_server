import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from 'src/modules/user/entities/user-profile.entity';
import { EmployeeStatus } from 'src/modules/user/enums/user.enum';
import { Status } from 'src/common/enums';

@Injectable()
export class EmployeeCountService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly userProfileRepo: Repository<UserProfile>,
  ) {}

  async getActiveEmployeeCount(organizationId: string): Promise<number> {
    return this.userProfileRepo.count({
      where: {
        organization_id: organizationId,
        employee_status: EmployeeStatus.ACTIVE,
        status: Status.ACTIVE,
      },
    });
  }
}
