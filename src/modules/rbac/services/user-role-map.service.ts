import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleMap } from '../entities/user-role-map.entity';
import { CreateUserRoleMapDto } from '../dto/create-user-role-map.dto';
import { UserRoleMapRepository } from '../repositories/user-role-map.repository';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { ListUserRoleMapsDto } from '../dto/list-user-role-maps.dto';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { User } from '../../user/entities/user.entity';
import { Role } from '../../role/entities/role.entity';



@Injectable()
export class UserRoleMapService {
  constructor(
    private readonly userRoleMapRepository: UserRoleMapRepository,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
  ) {}

  async create(dto: CreateUserRoleMapDto): Promise<UserRoleMap> {
    // A caller can't guess UUIDs into being a valid, coherent assignment —
    // user, role, and organization must actually belong together.
    const [user, role] = await Promise.all([
      this.userRepo.findOne({ where: { id: dto.user_id } }),
      this.roleRepo.findOne({ where: { id: dto.role_id } }),
    ]);

    if (!user || user.organization_id !== dto.organization_id) {
      throw new BadRequestException(
        'User does not belong to the specified organization.',
      );
    }
    if (!role || role.organization_id !== dto.organization_id) {
      throw new BadRequestException(
        'Role does not belong to the specified organization.',
      );
    }

    // Check for duplicate assignment
    const exists = await this.userRoleMapRepository.checkExists(
      dto.user_id,
      dto.role_id,
      dto.organization_id,
    );

    if (exists) {
      throw new ConflictException(
        'This role is already assigned to the user in this organization',
      );
    }

    const mapping = this.userRoleMapRepository.create(dto);
    return this.userRoleMapRepository.save(mapping);
  }

  async findAll(
    user: LoggedInUser,
    query: ListUserRoleMapsDto,
  ): Promise<PaginatedResponse<UserRoleMap>> {
    return this.userRoleMapRepository.findAll(user, query);
  }



  async findByUserId(userId: string, user: LoggedInUser): Promise<UserRoleMap[]> {
    return this.userRoleMapRepository.findByUserId(userId, user.organizationId);
  }

  async findOne(id: string, user: LoggedInUser): Promise<UserRoleMap> {
    return this.userRoleMapRepository.findOneById(id, user.organizationId);
  }

  async remove(id: string, user: LoggedInUser): Promise<void> {
    await this.findOne(id, user);
    await this.userRoleMapRepository.delete(id);
  }
}
