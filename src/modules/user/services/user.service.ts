import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository';
import { EnterpriseService } from '../../enterprise/services/enterprise.service';
import { OrganizationService } from '../../organization/services/organization.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { Status } from '../../../common/enums';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { ListEmployeesDto } from '../dto/list-employees.dto';
import { MapDepartmentDesignationDto } from '../dto/map-department-designation.dto';
import { UnmapDepartmentDesignationDto } from '../dto/unmap-department-designation.dto';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { ListingHelper } from '../../../common/utils/listing.helper';

// User Service - Implements business logic for user management
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly enterpriseService: EnterpriseService,
    @Inject(forwardRef(() => OrganizationService))
    private readonly organizationService: OrganizationService,
  ) { }

  // Hash password using bcrypt
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  // Verify password against hash
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Create a new user
  async create(createUserDto: CreateUserDto, loggedInUser?: LoggedInUser): Promise<User> {
    this.logger.log(`Creating user: ${createUserDto.email}`);

    // Validate enterprise exists
    await this.enterpriseService.findOneById(createUserDto.enterprise_id);

    // Validate organization exists
    await this.organizationService.findOne(createUserDto.organization_id);

    // Check email uniqueness
    const emailExists = await this.userRepository.emailExists(
      createUserDto.email,
    );
    if (emailExists) {
      throw new ConflictException(
        `User with email '${createUserDto.email}' already exists`,
      );
    }

    // Check phone uniqueness
    const phoneExists = await this.userRepository.phoneExists(
      createUserDto.phone,
    );
    if (phoneExists) {
      throw new ConflictException(
        `User with phone '${createUserDto.phone}' already exists`,
      );
    }

    // Hash password
    const password_hash = await this.hashPassword(createUserDto.password);

    // Create user
    const { password, ...userData } = createUserDto;
    const user = await this.userRepository.create({
      ...userData,
      password_hash,
      status: Status.ACTIVE,
    });

    this.logger.log(`User created successfully: ${user.id}`);
    return user;
  }

  // Create a new platform admin user (No enterprise required, starts PENDING)
  async createPlatformAdmin(
    registerDto: any,
    password_hash: string,
    loggedInUser?: LoggedInUser,
  ): Promise<User> {
    this.logger.log(`Creating platform admin: ${registerDto.email}`);

    // Check email uniqueness
    const emailExists = await this.userRepository.emailExists(
      registerDto.email,
    );
    if (emailExists) {
      throw new ConflictException(
        `User with email '${registerDto.email}' already exists`,
      );
    }

    // Check phone uniqueness
    const phoneExists = await this.userRepository.phoneExists(
      registerDto.phone_number,
    );
    if (phoneExists) {
      throw new ConflictException(
        `User with phone '${registerDto.phone_number}' already exists`,
      );
    }

    // Create user
    const { password, ...userData } = registerDto;
    const user = await this.userRepository.create({
      ...userData,
      phone: registerDto.phone_number,
      password_hash,
      is_platform_admin: true,
      status: Status.PENDING, // Will be activated via OTP
    });

    this.logger.log(`Platform admin created successfully: ${user.id}`);
    return user;
  }

  // Get all employees (users with both department and designation mapped)
  async findAll(
    loggedInUser: LoggedInUser,
    query: ListEmployeesDto,
  ): Promise<PaginatedResponse<any>> {
    this.logger.log('Fetching employee users (fully mapped)');
    const qb = this.userRepository.getListingQueryBuilder('user');

    // Only show users with both department and designation mapped
    qb.andWhere('user.department_id IS NOT NULL')
      .andWhere('user.designation_id IS NOT NULL');

    // Optional drill-down by specific department or designation
    if (query.departmentId) {
      qb.andWhere('user.department_id = :deptId', { deptId: query.departmentId });
    }

    if (query.designationId) {
      qb.andWhere('user.designation_id = :desigId', {
        desigId: query.designationId,
      });
    }

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    } else {
      qb.andWhere('user.status != :deleted', { deleted: Status.DELETED });
    }

    const response = await ListingHelper.apply(
      qb,
      query,
      loggedInUser,
      {
        searchFields: ['first_name', 'last_name', 'email'],
        filterFields: ['status'],
        alias: 'user',
      },
    );

    return {
      ...response,
      data: response.data.map((userInstance) =>
        this.mapUserToListItem(userInstance),
      ),
    };
  }

  // Get general users (users missing department or designation mapping)
  async findGeneralUsers(
    loggedInUser: LoggedInUser,
    query: ListEmployeesDto,
  ): Promise<PaginatedResponse<any>> {
    this.logger.log('Fetching general users (unmapped or partially mapped)');
    const qb = this.userRepository.getListingQueryBuilder('user');

    // Only show users missing department OR designation
    qb.andWhere(
      '(user.department_id IS NULL OR user.designation_id IS NULL)',
    );

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    } else {
      qb.andWhere('user.status != :deleted', { deleted: Status.DELETED });
    }

    const response = await ListingHelper.apply(
      qb,
      query,
      loggedInUser,
      {
        searchFields: ['first_name', 'last_name', 'email'],
        filterFields: ['status'],
        alias: 'user',
      },
    );

    return {
      ...response,
      data: response.data.map((userInstance) =>
        this.mapUserToListItem(userInstance),
      ),
    };
  }

  // Map a user entity to the standard list-item response shape
  private mapUserToListItem(userInstance: any): object {
    const photo = userInstance.user_profile?.photo;
    let avatarUrl: string | null = null;
    if (photo) {
      const region = 'us-east-1';
      avatarUrl = `https://${photo.bucket}.s3.${region}.amazonaws.com/${photo.object_key}`;
    }

    return {
      id: userInstance.id,
      firstName: userInstance.first_name,
      lastName: userInstance.last_name,
      email: userInstance.email,
      status: userInstance.status,
      departmentId: userInstance.department_id ?? null,
      designationId: userInstance.designation_id ?? null,
      avatar: avatarUrl,
      memberAvatars: avatarUrl ? [avatarUrl] : [],
    };
  }

  // Get a flat list of all non-deleted users scoped to the caller's org and enterprise (excluding caller)
  async listAllUsers(loggedInUser: LoggedInUser): Promise<object[]> {
    this.logger.log(
      `Fetching users for org=${loggedInUser.organizationId} enterprise=${loggedInUser.enterpriseId}`,
    );

    const users = await this.userRepository.findAllUsers(
      loggedInUser.organizationId,
      loggedInUser.enterpriseId,
      loggedInUser.userId,
    );

    return users.map((user) => ({
      id: user.id,
      firstName: user.first_name,
      middleName: user.middle_name ?? null,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      designationId: user.designation_id ?? null,
      departmentId: user.department_id ?? null,
    }));
  }

  // Provide functionality to map missing departmentId and designationId
  async mapDepartmentAndDesignation(
    dto: MapDepartmentDesignationDto,
    loggedInUser: LoggedInUser,
  ): Promise<User> {
    this.logger.log(`Mapping department/designation for user: ${dto.userId}`);

    // Verify user exists and check scope implicitly
    const user = await this.findOne(dto.userId, loggedInUser);

    const updateData: Partial<User> = {};

    // Identify users whose departmentId is missing and update only the missing fields
    if (!user.department_id && dto.departmentId) {
      updateData.department_id = dto.departmentId;
    }

    // Identify users whose designationId is missing and update only the missing fields
    if (!user.designation_id && dto.designationId) {
      updateData.designation_id = dto.designationId;
    }

    if (Object.keys(updateData).length === 0) {
      this.logger.log(`No missing fields to update for user: ${dto.userId}`);
      return user;
    }

    const updatedUser = await this.userRepository.update(dto.userId, updateData);

    if (!updatedUser) {
      throw new NotFoundException(`User with ID '${dto.userId}' not found after update`);
    }

    this.logger.log(`Successfully mapped fields for user: ${dto.userId}`);
    return updatedUser;
  }

  // Provide functionality to unmap departmentId and designationId
  async unmapDepartmentAndDesignation(
    dto: UnmapDepartmentDesignationDto,
    loggedInUser: LoggedInUser,
  ): Promise<User> {
    this.logger.log(`Unmapping department/designation for user: ${dto.userId}`);

    // Verify user exists
    const user = await this.findOne(dto.userId, loggedInUser);

    const updateData: Partial<User> = {};

    if (dto.unmapDepartment) {
      updateData.department_id = null as any;
    }

    if (dto.unmapDesignation) {
      updateData.designation_id = null as any;
    }

    if (Object.keys(updateData).length === 0) {
      this.logger.log(`No fields to unmap for user: ${dto.userId}`);
      return user;
    }

    const updatedUser = await this.userRepository.update(dto.userId, updateData);

    if (!updatedUser) {
      throw new NotFoundException(`User with ID '${dto.userId}' not found after update`);
    }

    this.logger.log(`Successfully unmapped fields for user: ${dto.userId}`);
    return updatedUser;
  }

  // Get user by ID
  async findOne(id: string, loggedInUser?: LoggedInUser): Promise<User> {
    this.logger.log(`Fetching user: ${id}`);

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  // Get user by email
  async findByEmail(email: string, loggedInUser?: LoggedInUser): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  // Update a user
  async update(id: string, updateUserDto: UpdateUserDto, loggedInUser?: LoggedInUser): Promise<User> {
    this.logger.log(`Updating user: ${id}`);

    // Verify user exists
    await this.findOne(id, loggedInUser);

    // Validate enterprise if being updated
    if (updateUserDto.enterprise_id) {
      await this.enterpriseService.findOneById(updateUserDto.enterprise_id);
    }

    // Validate organization if being updated
    if (updateUserDto.organization_id) {
      await this.organizationService.findOne(updateUserDto.organization_id);
    }

    // Check email uniqueness if being updated
    if (updateUserDto.email) {
      const emailExists = await this.userRepository.emailExists(
        updateUserDto.email,
        id,
      );
      if (emailExists) {
        throw new ConflictException(
          `User with email '${updateUserDto.email}' already exists`,
        );
      }
    }

    // Check phone uniqueness if being updated
    if (updateUserDto.phone) {
      const phoneExists = await this.userRepository.phoneExists(
        updateUserDto.phone,
        id,
      );
      if (phoneExists) {
        throw new ConflictException(
          `User with phone '${updateUserDto.phone}' already exists`,
        );
      }
    }

    const updatedUser = await this.userRepository.update(id, updateUserDto);

    if (!updatedUser) {
      throw new NotFoundException(
        `User with ID '${id}' not found after update`,
      );
    }

    this.logger.log(`User updated successfully: ${id}`);
    return updatedUser;
  }

  // Delete a user (soft delete)
  async remove(id: string, loggedInUser?: LoggedInUser): Promise<void> {
    this.logger.log(`Deleting user: ${id}`);

    // Verify user exists
    await this.findOne(id, loggedInUser);

    await this.userRepository.softDelete(id);

    this.logger.log(`User deleted successfully: ${id}`);
  }
}
