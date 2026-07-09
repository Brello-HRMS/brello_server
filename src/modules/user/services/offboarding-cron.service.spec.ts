import { OffboardingCronService } from './offboarding-cron.service';
import { EmployeeStatus } from '../enums/user.enum';
import { Status } from '../../../common/enums';

describe('OffboardingCronService', () => {
  let profileRepository: any;
  let userRepository: any;
  let offboardingRepository: any;
  let service: OffboardingCronService;

  const record = { user_id: 'user-1', last_working_day: new Date('2020-01-01'), is_cancelled: false };
  const offboardingProfile = { id: 'profile-1', employee_status: EmployeeStatus.OFFBOARDING };

  beforeEach(() => {
    profileRepository = {
      findByUserId: jest.fn().mockResolvedValue(offboardingProfile),
      update: jest.fn().mockResolvedValue(undefined),
    };
    userRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    offboardingRepository = {
      find: jest.fn().mockResolvedValue([record]),
    };
    service = new OffboardingCronService(profileRepository, userRepository, offboardingRepository);
  });

  it('sets User.status to INACTIVE, not just the profile employee_status', async () => {
    await service.handleOffboarding();

    expect(profileRepository.update).toHaveBeenCalledWith(
      offboardingProfile.id,
      expect.objectContaining({ employee_status: EmployeeStatus.INACTIVE, status: Status.INACTIVE }),
    );
    expect(userRepository.update).toHaveBeenCalledWith(
      record.user_id,
      expect.objectContaining({ status: Status.INACTIVE }),
    );
  });

  it('is idempotent — skips a profile that has already been offboarded', async () => {
    profileRepository.findByUserId.mockResolvedValue({ id: 'profile-1', employee_status: EmployeeStatus.INACTIVE });

    await service.handleOffboarding();

    expect(profileRepository.update).not.toHaveBeenCalled();
    expect(userRepository.update).not.toHaveBeenCalled();
  });
});
