import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { UserRepository } from '../repositories/user.repository';
import { UserProfileRepository } from '../repositories/user-profile.repository';
import { UserEducationRepository } from '../repositories/user-education.repository';
import { UserExperienceRepository } from '../repositories/user-experience.repository';
import { UserAssetsRepository } from '../repositories/user-assets.repository';
import { UserGovInfoRepository } from '../repositories/user-gov-info.repository';
import { UserBankInfoRepository } from '../repositories/user-bank-info.repository';
import { UserEmergencyPersonRepository } from '../repositories/user-emergency-person.repository';
import { UserDocumentRepository } from '../repositories/user-document.repository';

import {
  CreateEmployeeDto,
  UpdateEmployeeBasicDto,
  UpdateEmployeeProfileDto,
  AddEducationDto,
  AddExperienceDto,
  AddAssetDto,
  UpdateGovInfoDto,
  UpdateBankInfoDto,
  AddDocumentDto,
  UpdateEmergencyContactDto,
  EmployeeExitDto,
} from '../dto';

import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly profileRepository: UserProfileRepository,
    private readonly educationRepository: UserEducationRepository,
    private readonly experienceRepository: UserExperienceRepository,
    private readonly assetsRepository: UserAssetsRepository,
    private readonly govInfoRepository: UserGovInfoRepository,
    private readonly bankInfoRepository: UserBankInfoRepository,
    private readonly emergencyRepository: UserEmergencyPersonRepository,
    private readonly documentRepository: UserDocumentRepository,
  ) {}

  async createEmployee(dto: CreateEmployeeDto): Promise<any> {
    this.logger.log(`Creating employee aggregate for: ${dto.email}`);

    // Pre-flight validation
    const emailExistsInUsers = await this.userRepository.emailExists(dto.email);
    if (emailExistsInUsers) {
      throw new ConflictException(
        `User with email '${dto.email}' already exists.`,
      );
    }

    const phoneExistsInUsers = await this.userRepository.phoneExists(dto.phone);
    if (phoneExistsInUsers) {
      throw new ConflictException(
        `User with phone '${dto.phone}' already exists.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const passwordHash = await bcrypt.hash(dto.password, 10);

      // Create User
      const userInstance = queryRunner.manager.create(User, {
        first_name: dto.firstName,
        middle_name: dto.middleName,
        last_name: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        password_hash: passwordHash,
        enterprise_id: dto.enterprise_id,
        organization_id: dto.organization_id,
        reports_to_id: dto.reportsTo,
        department_id: dto.departmentId,
        designation_id: dto.designationId,
        status: Status.ACTIVE,
      });

      const savedUser = await queryRunner.manager.save(userInstance);

      // Create Profile
      const profileInstance = queryRunner.manager.create(UserProfile, {
        employee_id: dto.profile.employeeId,
        type: dto.profile.type,
        email: dto.email, // Mirror email/phone from auth
        phone: dto.phone,
        dob: dto.profile.dob ? new Date(dto.profile.dob) : undefined,
        gender: dto.profile.gender,
        marital_status: dto.profile.maritalStatus,
        joining_date: dto.profile.joiningDate
          ? new Date(dto.profile.joiningDate)
          : undefined,
        employment_type: dto.profile.employmentType,
        work_location: dto.profile.workLocation,
        blood_group: dto.profile.bloodGroup,
        notice_period: dto.profile.noticePeriod ?? 30,
        current_salary: dto.profile.currentSalary,
        enterprise_id: dto.enterprise_id,
        organization_id: dto.organization_id,
        status: Status.ACTIVE,
      });

      const savedProfile = await queryRunner.manager.save(profileInstance);

      // Link them together
      await queryRunner.manager.update(User, savedUser.id, {
        user_profile_id: savedProfile.id,
      });

      await queryRunner.manager.update(UserProfile, savedProfile.id, {
        user: { id: savedUser.id } as any,
      });

      await queryRunner.commitTransaction();

      this.logger.log(
        `Created employee aggregate successfully. User ID: ${savedUser.id}`,
      );

      return {
        id: savedUser.id,
        employeeId: dto.profile.employeeId,
        status: Status.ACTIVE,
        createdAt: savedUser.created_at,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create employee: ${(err as Error).message}`);
      if (err.code === '23505') {
        throw new ConflictException(
          'A unique constraint failed. Check employeeId or other unique fields.',
        );
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getEmployeeAggregate(id: string): Promise<any> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`Employee with ID '${id}' not found`);
    }

    let profileData: UserProfile | null = null;
    if (user.user_profile_id) {
      // Assuming findById on profile repo handles relations
      profileData = await this.profileRepository.findByUserId(user.id);
    }

    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      reportsTo: user.reports_to_id,
      profile: profileData
        ? {
            employeeId: profileData.employee_id,
            type: profileData.type,
            dob: profileData.dob,
            gender: profileData.gender,
            joiningDate: profileData.joining_date,
            noticePeriod: profileData.notice_period,
            currentSalary: profileData.current_salary,
          }
        : null,
      education: profileData?.educations || [],
      experience: profileData?.experiences || [],
      assets: profileData?.assets || [],
      documents: profileData?.documents || [],
      bankInfo: profileData?.bank_info || {},
      govInfo: profileData?.gov_info || {},
      emergencyContact: profileData?.emergency_contacts || [],
    };
  }

  async listEmployees(query: any): Promise<any> {
    // Basic implementation for demonstration
    // A complete implementation would build a complex QueryBuilder here
    // filtering by department, designation, search text, limit/offset.
    const users = await this.userRepository.findAll();
    return {
      data: users.map((user) => ({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        status: user.status,
      })),
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total: users.length,
      },
    };
  }

  async updateBasicInfo(id: string, dto: UpdateEmployeeBasicDto): Promise<any> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('Employee not found');

    const updateData: Partial<User> = {};
    if (dto.firstName) updateData.first_name = dto.firstName;
    if (dto.lastName) updateData.last_name = dto.lastName;
    if (dto.middleName) updateData.middle_name = dto.middleName;
    if (dto.phone) updateData.phone = dto.phone;
    if (dto.reportsTo) updateData.reports_to_id = dto.reportsTo;
    if (dto.departmentId) updateData.department_id = dto.departmentId;
    if (dto.designationId) updateData.designation_id = dto.designationId;

    await this.userRepository.update(id, updateData);

    // Attempt sync if phone updated and profile exists
    if (dto.phone && user.user_profile_id) {
      await this.profileRepository.update(user.user_profile_id, {
        phone: dto.phone,
      });
    }

    return { success: true };
  }

  async updateProfile(id: string, dto: UpdateEmployeeProfileDto): Promise<any> {
    const user = await this.userRepository.findById(id);
    if (!user || !user.user_profile_id)
      throw new NotFoundException('Employee or Profile not found');

    const updateData: Partial<UserProfile> = {};
    if (dto.dob) updateData.dob = new Date(dto.dob);
    if (dto.gender) updateData.gender = dto.gender;
    if (dto.maritalStatus) updateData.marital_status = dto.maritalStatus;
    if (dto.joiningDate) updateData.joining_date = new Date(dto.joiningDate);
    if (dto.employmentType) updateData.employment_type = dto.employmentType;
    if (dto.workLocation) updateData.work_location = dto.workLocation;
    if (dto.bloodGroup) updateData.blood_group = dto.bloodGroup;
    if (dto.noticePeriod !== undefined)
      updateData.notice_period = dto.noticePeriod;
    if (dto.currentSalary) updateData.current_salary = dto.currentSalary;

    await this.profileRepository.update(user.user_profile_id, updateData);
    return { success: true };
  }

  // Education Endpoints
  async addEducation(id: string, dto: AddEducationDto): Promise<any> {
    const profile = await this.validateProfileAccess(id);
    await this.educationRepository.create({
      school_name: dto.schoolName,
      degree: dto.degree,
      field_of_study: dto.fieldOfStudy,
      completion_date: new Date(dto.completionDate),
      additional_detail: dto.additionalDetail,
      user_profile_id: profile.id,
      status: Status.ACTIVE,
    });
    return { success: true };
  }

  async deleteEducation(id: string, educationId: string): Promise<any> {
    await this.validateProfileAccess(id); // Ensures user exists
    await this.educationRepository.softDelete(educationId);
    return { success: true };
  }

  // Experience Endpoints
  async addExperience(id: string, dto: AddExperienceDto): Promise<any> {
    const profile = await this.validateProfileAccess(id);
    await this.experienceRepository.create({
      occupation: dto.occupation,
      company: dto.company,
      summary: dto.summary,
      duration: dto.duration,
      user_profile_id: profile.id,
      status: Status.ACTIVE,
    });
    return { success: true };
  }

  async deleteExperience(id: string, experienceId: string): Promise<any> {
    await this.validateProfileAccess(id);
    await this.experienceRepository.softDelete(experienceId);
    return { success: true };
  }

  // Asset Endpoints
  async addAsset(id: string, dto: AddAssetDto): Promise<any> {
    const profile = await this.validateProfileAccess(id);
    await this.assetsRepository.create({
      name: dto.name,
      user_profile_id: profile.id,
      status: Status.ACTIVE,
    });
    return { success: true };
  }

  async deleteAsset(id: string, assetId: string): Promise<any> {
    await this.validateProfileAccess(id);
    await this.assetsRepository.softDelete(assetId);
    return { success: true };
  }

  // Gov Info
  async updateGovInfo(id: string, dto: UpdateGovInfoDto): Promise<any> {
    const profile = await this.validateProfileAccess(id);
    await this.govInfoRepository.upsert({
      uan: dto.uan,
      aadhaar: dto.aadhaar,
      pan: dto.pan,
      esi: dto.esi,
      passport: dto.passport,
      driving_licence: dto.drivingLicence,
      user_profile_id: profile.id,
      status: Status.ACTIVE,
    });
    return { success: true };
  }

  // Bank Info
  async updateBankInfo(id: string, dto: UpdateBankInfoDto): Promise<any> {
    const profile = await this.validateProfileAccess(id);
    await this.bankInfoRepository.upsert({
      account_number: dto.accountNumber,
      ifsc_code: dto.ifscCode,
      bank_name: dto.bankName,
      user_profile_id: profile.id,
      status: Status.ACTIVE,
    });
    return { success: true };
  }

  // Documents
  async attachDocument(id: string, dto: AddDocumentDto): Promise<any> {
    const profile = await this.validateProfileAccess(id);
    await this.documentRepository.create({
      name: dto.name,
      doc_id: dto.docId,
      user_profile_id: profile.id,
      status: Status.ACTIVE,
    });
    return { success: true };
  }

  async removeDocument(id: string, docId: string): Promise<any> {
    await this.validateProfileAccess(id);
    await this.documentRepository.softDelete(docId); // docId from parameter could be the user_document table ID, not S3 doc ID
    return { success: true };
  }

  // Emergency Contact
  async updateEmergencyContact(
    id: string,
    dto: UpdateEmergencyContactDto,
  ): Promise<any> {
    const profile = await this.validateProfileAccess(id);
    // Over simplified upsert behavior for demonstration per schema rules
    // Usually these might be 1:N or 1:1, schema showed 1:N array in GET request
    await this.emergencyRepository.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      relation: dto.relation,
      user_profile_id: profile.id,
      status: Status.ACTIVE,
    });
    return { success: true };
  }

  // Exit
  async submitExit(id: string, dto: EmployeeExitDto): Promise<any> {
    const profile = await this.validateProfileAccess(id);
    await this.profileRepository.update(profile.id, {
      exit_type: dto.exitType,
      last_working_day: dto.lastWorkingDay
        ? new Date(dto.lastWorkingDay)
        : undefined,
      exit_reason: dto.exitReason,
    });
    return { success: true };
  }

  async softDeleteEmployee(id: string): Promise<any> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`Employee ${id} not found.`);
    }

    // Soft delete the User auth record
    await this.userRepository.softDelete(id);

    // Soft delete the profile layer (prevent cascading manually or rely on ORM hooks, manual is safer for soft deletes)
    if (user.user_profile_id) {
      await this.profileRepository.update(user.user_profile_id, {
        status: Status.DELETED,
      });
    }

    return { success: true };
  }

  private async validateProfileAccess(userId: string): Promise<UserProfile> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.user_profile_id) {
      throw new NotFoundException('Employee or Profile not found.');
    }
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Profile record not found.');
    return profile;
  }
}
