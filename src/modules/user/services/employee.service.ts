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
import { EmployeeOffboardingRepository } from '../repositories/offboarding.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';

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
  InitiateOffboardingDto,
  UpdateOffboardingDto,
  UploadDocumentsDto,
  UpdatePayrollInfoDto,
} from '../dto';

import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { EmployeeOffboarding } from '../entities/offboarding.entity';
import { Status } from '../../../common/enums';
import { EmployeeStatus, ExitType } from '../enums/user.enum';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { ListEmployeesDto } from '../dto/list-employees.dto';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { ListingHelper } from '../../../common/utils/listing.helper';

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
    private readonly offboardingRepository: EmployeeOffboardingRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  private async createAuditLog(
    actorId: string,
    action: string,
    oldValue: any,
    newValue: any,
    targetId: string,
    targetType: string,
  ) {
    await this.auditLogRepository.save({
      actor_id: actorId,
      action,
      old_value: oldValue,
      new_value: newValue,
      target_id: targetId,
      target_type: targetType,
    });
  }

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

  async getProfileCompletion(id: string): Promise<any> {
    const profile = await this.validateProfileAccess(id);
    const sections = [
      {
        name: 'personal_details',
        check: () => !!profile.dob && !!profile.gender,
      },
      {
        name: 'employment_details',
        check: () => !!profile.joining_date && !!profile.employment_type,
      },
      {
        name: 'bank_details',
        check: () => !!profile.bank_info?.account_number,
      },
      {
        name: 'gov_info',
        check: () => !!profile.gov_info?.pan || !!profile.gov_info?.aadhaar,
      },
      {
        name: 'documents',
        check: () => profile.documents && profile.documents.length > 0,
      },
    ];

    const missing_sections = sections
      .filter((s) => !s.check())
      .map((s) => s.name);
    const completion_percentage =
      ((sections.length - missing_sections.length) / sections.length) * 100;

    return {
      completion_percentage: Math.round(completion_percentage),
      missing_sections,
    };
  }

  async listEmployees(
    user: LoggedInUser,
    query: ListEmployeesDto,
  ): Promise<PaginatedResponse<any>> {
    this.logger.log(`User ${user.userId} is listing employees`);

    const qb = this.userRepository.getListingQueryBuilder('user');

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
      user,
      {
        searchFields: ['first_name', 'last_name', 'email'],
        filterFields: ['status', 'departmentId', 'designationId'],
        alias: 'user',
      },
    );

    const items = response.data.map((userInstance) => {
      const photo = userInstance.user_profile?.photo;
      let avatarUrl: string | null = null;
      if (photo) {
        const region = 'us-east-1'; // fallback
        avatarUrl = `https://${photo.bucket}.s3.${region}.amazonaws.com/${photo.object_key}`;
      }

      return {
        id: userInstance.id,
        firstName: userInstance.first_name,
        lastName: userInstance.last_name,
        email: userInstance.email,
        status: userInstance.status,
        avatar: avatarUrl,
        memberAvatars: avatarUrl ? [avatarUrl] : [], // For employees, show their own avatar as first
      };
    });

    return {
      ...response,
      data: items,
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

  async updatePersonalDetails(
    id: string,
    dto: UpdateEmployeeProfileDto,
    actorId: string,
  ): Promise<any> {
    const user = await this.userRepository.findById(id);
    if (!user || !user.user_profile_id)
      throw new NotFoundException('Employee or Profile not found');

    const profile = await this.profileRepository.findByUserId(id);
    const oldValue = JSON.parse(JSON.stringify(profile));

    const updateData: Partial<UserProfile> = {};
    if (dto.dob) updateData.dob = new Date(dto.dob);
    if (dto.gender) updateData.gender = dto.gender;
    if (dto.maritalStatus) updateData.marital_status = dto.maritalStatus;
    if (dto.bloodGroup) updateData.blood_group = dto.bloodGroup;

    const updatedProfile = await this.profileRepository.update(
      user.user_profile_id,
      updateData,
    );

    await this.createAuditLog(
      actorId,
      'UPDATE_PERSONAL_DETAILS',
      oldValue,
      updatedProfile,
      id,
      'user',
    );

    return { success: true };
  }

  async updateEmploymentDetails(
    id: string,
    dto: UpdateEmployeeBasicDto & UpdateEmployeeProfileDto,
    actorId: string,
  ): Promise<any> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('Employee not found');

    const oldValue = JSON.parse(JSON.stringify(user));

    const userUpdate: Partial<User> = {};
    if (dto.departmentId) userUpdate.department_id = dto.departmentId;
    if (dto.designationId) userUpdate.designation_id = dto.designationId;
    if (dto.reportsTo) userUpdate.reports_to_id = dto.reportsTo;

    const updatedUser = await this.userRepository.update(id, userUpdate);

    if (user.user_profile_id) {
      const profileUpdate: Partial<UserProfile> = {};
      if (dto.employmentType)
        profileUpdate.employment_type = dto.employmentType;
      if (dto.workLocation) profileUpdate.work_location = dto.workLocation;
      if (dto.joiningDate)
        profileUpdate.joining_date = new Date(dto.joiningDate);
      if (dto.currentSalary) profileUpdate.current_salary = dto.currentSalary;

      await this.profileRepository.update(user.user_profile_id, profileUpdate);
    }

    await this.createAuditLog(
      actorId,
      'UPDATE_EMPLOYMENT_DETAILS',
      oldValue,
      updatedUser,
      id,
      'user',
    );

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

  async updateEducation(
    id: string,
    educationId: string,
    dto: AddEducationDto,
  ): Promise<any> {
    await this.validateProfileAccess(id);
    await this.educationRepository.update(educationId, {
      school_name: dto.schoolName,
      degree: dto.degree,
      field_of_study: dto.fieldOfStudy,
      completion_date: new Date(dto.completionDate),
      additional_detail: dto.additionalDetail,
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

  async updateExperience(
    id: string,
    experienceId: string,
    dto: AddExperienceDto,
  ): Promise<any> {
    await this.validateProfileAccess(id);
    await this.experienceRepository.update(experienceId, {
      occupation: dto.occupation,
      company: dto.company,
      summary: dto.summary,
      duration: dto.duration,
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

  async updatePayrollInformation(
    id: string,
    dto: UpdatePayrollInfoDto,
    actorId: string,
  ): Promise<any> {
    const profile = await this.validateProfileAccess(id);
    const oldValue = {
      bank_info: profile.bank_info,
      gov_info: profile.gov_info,
    };

    if (dto.bank_info) {
      await this.bankInfoRepository.upsert({
        ...dto.bank_info,
        user_profile_id: profile.id,
        status: Status.ACTIVE,
      });
    }

    if (dto.gov_info) {
      await this.govInfoRepository.upsert({
        ...dto.gov_info,
        user_profile_id: profile.id,
        status: Status.ACTIVE,
      });
    }

    const updatedProfile = await this.validateProfileAccess(id);
    await this.createAuditLog(
      actorId,
      'UPDATE_PAYROLL_INFO',
      oldValue,
      {
        bank_info: updatedProfile.bank_info,
        gov_info: updatedProfile.gov_info,
      },
      id,
      'user',
    );

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

  async uploadDocuments(
    id: string,
    dto: UploadDocumentsDto,
    actorId: string,
  ): Promise<any> {
    const profile = await this.validateProfileAccess(id);
    for (const doc of dto.documents) {
      await this.documentRepository.create({
        name: doc.name,
        doc_id: doc.docId,
        user_profile_id: profile.id,
        status: Status.ACTIVE,
      });
    }

    await this.createAuditLog(
      actorId,
      'UPLOAD_DOCUMENTS',
      null,
      dto.documents,
      id,
      'user',
    );

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

  async initiateOffboarding(
    id: string,
    dto: InitiateOffboardingDto,
    actorId: string,
  ): Promise<any> {
    const profile = await this.validateProfileAccess(id);

    await this.offboardingRepository.save({
      user_id: id,
      exit_type: dto.exit_type,
      reason: dto.reason,
      last_working_day: new Date(dto.last_working_day),
      notice_period: dto.notice_period || profile.notice_period,
    });

    await this.profileRepository.update(profile.id, {
      employee_status: EmployeeStatus.OFFBOARDING,
    });

    await this.createAuditLog(
      actorId,
      'INITIATE_OFFBOARDING',
      { status: profile.employee_status },
      { status: EmployeeStatus.OFFBOARDING, ...dto },
      id,
      'user',
    );

    return { success: true };
  }

  async updateOffboarding(
    id: string,
    dto: UpdateOffboardingDto,
    actorId: string,
  ): Promise<any> {
    const offboarding = await this.offboardingRepository.findByUserId(id);
    if (!offboarding) throw new NotFoundException('Offboarding not initiated');

    const oldValue = JSON.parse(JSON.stringify(offboarding));

    const updateData: Partial<EmployeeOffboarding> = {};
    if (dto.reason) updateData.reason = dto.reason;
    if (dto.last_working_day)
      updateData.last_working_day = new Date(dto.last_working_day);
    if (dto.notice_period) updateData.notice_period = dto.notice_period;

    await this.offboardingRepository.update(offboarding.id, updateData);

    await this.createAuditLog(
      actorId,
      'UPDATE_OFFBOARDING',
      oldValue,
      updateData,
      id,
      'user',
    );

    return { success: true };
  }

  async cancelOffboarding(id: string, actorId: string): Promise<any> {
    const offboarding = await this.offboardingRepository.findByUserId(id);
    if (!offboarding) throw new NotFoundException('Offboarding not initiated');

    await this.offboardingRepository.update(offboarding.id, {
      is_cancelled: true,
    });

    const profile = await this.validateProfileAccess(id);
    await this.profileRepository.update(profile.id, {
      employee_status: EmployeeStatus.ACTIVE,
    });

    await this.createAuditLog(
      actorId,
      'CANCEL_OFFBOARDING',
      { status: EmployeeStatus.OFFBOARDING },
      { status: EmployeeStatus.ACTIVE },
      id,
      'user',
    );

    return { success: true };
  }

  async getOffboardingDetails(id: string): Promise<any> {
    const offboarding = await this.offboardingRepository.findByUserId(id);
    if (!offboarding) throw new NotFoundException('Offboarding not initiated');

    return offboarding;
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
