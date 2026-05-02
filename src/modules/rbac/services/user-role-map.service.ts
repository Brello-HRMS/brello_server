import { Injectable, ConflictException } from '@nestjs/common';
import { UserRoleMap } from '../entities/user-role-map.entity';
import { CreateUserRoleMapDto } from '../dto/create-user-role-map.dto';
import { UserRoleMapRepository } from '../repositories/user-role-map.repository';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { ListUserRoleMapsDto } from '../dto/list-user-role-maps.dto';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';



@Injectable()
export class UserRoleMapService {
  constructor(private readonly userRoleMapRepository: UserRoleMapRepository) {}

  async create(dto: CreateUserRoleMapDto): Promise<UserRoleMap> {
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



  async findByUserId(userId: string): Promise<UserRoleMap[]> {
    return this.userRoleMapRepository.findByUserId(userId);
  }

  async findOne(id: string): Promise<UserRoleMap> {
    return this.userRoleMapRepository.findOneById(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.userRoleMapRepository.delete(id);
  }
}
