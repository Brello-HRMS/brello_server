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
import { UserDepartmentRepository } from '../repositories/department.repository';
import { UserDesignationRepository } from '../repositories/designation.repository';
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
    private readonly departmentRepository: UserDepartmentRepository,
    private readonly designationRepository: UserDesignationRepository,
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
    await this.enterpriseService.findOneById(createUserDto.enterprise_id, loggedInUser);

    // Validate organization exists
    await this.organizationService.findOne(createUserDto.organization_id, loggedInUser);

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
  // Routes to department or designation repository based on which context ID is provided.
  async findAll(
    loggedInUser: LoggedInUser,
    query: ListEmployeesDto,
  ): Promise<PaginatedResponse<any>> {
    this.logger.log('Fetching employee users (fully mapped)');

    const qb = query.designationId
      ? this.designationRepository.getEmployeeListingQueryBuilder(query)
      : this.departmentRepository.getEmployeeListingQueryBuilder(query);

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
  // Routes to department or designation repository based on which context ID is provided.
  async findGeneralUsers(
    loggedInUser: LoggedInUser,
    query: ListEmployeesDto,
  ): Promise<PaginatedResponse<any>> {
    this.logger.log('Fetching general users (unmapped or partially mapped)');

    let qb: any;
    if (query.departmentId) {
      qb = this.departmentRepository.getGeneralListingQueryBuilder(query);
    } else if (query.designationId) {
      qb = this.designationRepository.getGeneralListingQueryBuilder(query);
    } else {
      const baseQb = this.userRepository.getListingQueryBuilder('user');
      baseQb
        .andWhere('(user.department_id IS NULL OR user.designation_id IS NULL)')
        .andWhere('user.status != :deleted', { deleted: Status.DELETED });
      qb = baseQb;
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

  // Map missing departmentId and/or designationId for a user
  async mapDepartmentAndDesignation(
    dto: MapDepartmentDesignationDto,
    loggedInUser: LoggedInUser,
  ): Promise<User> {
    this.logger.log(`Mapping department/designation for user: ${dto.userId}`);

    const user = await this.findOne(dto.userId, loggedInUser);

    if (!user.department_id && dto.departmentId) {
      await this.departmentRepository.mapDepartment(dto.userId, dto.departmentId);
    }

    if (!user.designation_id && dto.designationId) {
      await this.designationRepository.mapDesignation(dto.userId, dto.designationId);
    }

    const updatedUser = await this.userRepository.findById(dto.userId);
    if (!updatedUser) {
      throw new NotFoundException(`User with ID '${dto.userId}' not found after update`);
    }

    this.logger.log(`Successfully mapped fields for user: ${dto.userId}`);
    return updatedUser;
  }

  // Unmap departmentId and/or designationId for a user
  async unmapDepartmentAndDesignation(
    dto: UnmapDepartmentDesignationDto,
    loggedInUser: LoggedInUser,
  ): Promise<User> {
    this.logger.log(`Unmapping department/designation for user: ${dto.userId}`);

    await this.findOne(dto.userId, loggedInUser);

    if (dto.unmapDepartment) {
      await this.departmentRepository.unmapDepartment(dto.userId);
    }

    if (dto.unmapDesignation) {
      await this.designationRepository.unmapDesignation(dto.userId);
    }

    const updatedUser = await this.userRepository.findById(dto.userId);
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
      await this.enterpriseService.findOneById(updateUserDto.enterprise_id, loggedInUser);
    }

    // Validate organization if being updated
    if (updateUserDto.organization_id) {
      await this.organizationService.findOne(updateUserDto.organization_id, loggedInUser);
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
