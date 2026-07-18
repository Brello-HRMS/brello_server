// uuid ships ESM-only; jest's default transform config can't parse it, so
// stub it out before user.service.ts's transitive imports pull it in.
jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

import { UserService } from './user.service';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

const loggedInUser: LoggedInUser = {
  userId: 'user1',
  enterpriseId: 'ent1',
  organizationId: 'org1',
  appId: 'app1',
  isPlatformAdmin: false,
};

describe('UserService tenant-check propagation', () => {
  let userRepository: any;
  let departmentRepository: any;
  let designationRepository: any;
  let enterpriseService: any;
  let organizationService: any;
  let service: UserService;

  beforeEach(() => {
    userRepository = {
      emailExists: jest.fn(() => Promise.resolve(false)),
      phoneExists: jest.fn(() => Promise.resolve(false)),
      create: jest.fn((d) => Promise.resolve({ id: 'newUser', ...d })),
      findById: jest.fn(() => Promise.resolve({ id: 'user2' })),
      update: jest.fn((id, d) => Promise.resolve({ id, ...d })),
    };
    departmentRepository = {};
    designationRepository = {};
    enterpriseService = { findOneById: jest.fn(() => Promise.resolve({ id: 'ent1' })) };
    organizationService = { findOne: jest.fn(() => Promise.resolve({ id: 'org1' })) };

    service = new UserService(
      userRepository,
      departmentRepository,
      designationRepository,
      enterpriseService,
      organizationService,
    );
  });

  it('create() forwards loggedInUser to the enterprise/organization tenant checks', async () => {
    await service.create(
      {
        enterprise_id: 'ent1',
        organization_id: 'org1',
        email: 'a@b.com',
        phone: '123',
        password: 'x',
      } as any,
      loggedInUser,
    );

    expect(enterpriseService.findOneById).toHaveBeenCalledWith('ent1', loggedInUser);
    expect(organizationService.findOne).toHaveBeenCalledWith('org1', loggedInUser);
  });

  it('update() forwards loggedInUser to the enterprise/organization tenant checks', async () => {
    await service.update(
      'user2',
      { enterprise_id: 'ent1', organization_id: 'org1' } as any,
      loggedInUser,
    );

    expect(enterpriseService.findOneById).toHaveBeenCalledWith('ent1', loggedInUser);
    expect(organizationService.findOne).toHaveBeenCalledWith('org1', loggedInUser);
  });
});
