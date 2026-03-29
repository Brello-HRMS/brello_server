import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { LeadRepository } from '../repositories/lead.repository';
import { OtpRepository } from '../../auth/repositories/otp.repository';
import { NotificationService } from '../../notification/services/notification.service';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { VerifyLeadOtpDto } from '../dto/verify-lead-otp.dto';
import { Lead } from '../entities/lead.entity';
import { User } from '../../user/entities/user.entity';
import { LeadSource } from '../enums/lead-source.enum';
import { LeadStatus } from '../enums/lead-status.enum';
import { OtpPurpose } from '../../../common/enums';
import { NotificationType } from '../../../common/enums/notification-type.enum';
import { Status } from '../../../common/enums';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly otpRepository: OtpRepository,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  // Register a new lead and send OTP
  async registerLead(
    createLeadDto: CreateLeadDto,
    user?: LoggedInUser,
  ): Promise<void> {
    this.logger.log(
      `Lead registration initiated for email: ${createLeadDto.email}`,
    );

    await this.ensureEmailNotTaken(createLeadDto.email);

    const passwordHash = await this.hashValue(createLeadDto.password);

    const lead = await this.leadRepository.create({
      email: createLeadDto.email,
      first_name: createLeadDto.first_name,
      last_name: createLeadDto.last_name,
      phone: createLeadDto.phone,
      password_hash: passwordHash,
      location: createLeadDto.location || undefined,
      device: createLeadDto.device || undefined,
      source: LeadSource.WEBSITE,
      lead_status: LeadStatus.NEW,
      is_verified: false,
      plan_id: createLeadDto.plan_id,
    });

    await this.generateAndSendOtp(lead.email);

    this.logger.log(`Lead registered successfully: ${lead.id}`);
  }

  // Verify OTP and create user transactionally
  async verifyLeadOtp(
    verifyDto: VerifyLeadOtpDto,
    user?: LoggedInUser,
  ): Promise<void> {
    this.logger.log(`Lead OTP verification for email: ${verifyDto.email}`);

    const lead = await this.findLeadByEmailOrFail(verifyDto.email);

    if (lead.is_verified) {
      throw new BadRequestException('Lead is already verified');
    }

    await this.validateAndConsumeOtp(verifyDto.email, verifyDto.otp);

    await this.verifyLeadAndCreateUser(lead);

    this.logger.log(`Lead ${lead.id} verified and user created successfully`);
  }

  // --- Private Helpers ---

  private async ensureEmailNotTaken(email: string): Promise<void> {
    const existingLead = await this.leadRepository.findByEmail(email);
    if (existingLead) {
      throw new ConflictException(`Lead with email '${email}' already exists`);
    }
  }

  private async findLeadByEmailOrFail(email: string): Promise<Lead> {
    const lead = await this.leadRepository.findByEmail(email);
    if (!lead) {
      throw new BadRequestException('No lead found with this email');
    }
    return lead;
  }

  private async hashValue(value: string): Promise<string> {
    return bcrypt.hash(value, this.SALT_ROUNDS);
  }

  private async verifyHash(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private calculateOtpExpiration(): Date {
    const minutes = this.configService.get<number>('otp.expirationMinutes', 10);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
    return expiresAt;
  }

  private async generateAndSendOtp(email: string): Promise<void> {
    // Clean up existing OTPs
    await this.otpRepository.deleteByIdentifierAndPurpose(
      email,
      OtpPurpose.LEAD_VERIFICATION,
    );

    const otp = this.generateOtp();
    const otpHash = await this.hashValue(otp);

    await this.otpRepository.create({
      identifier: email,
      otp_hash: otpHash,
      purpose: OtpPurpose.LEAD_VERIFICATION,
      expires_at: this.calculateOtpExpiration(),
      attempts_count: 0,
    });

    this.notificationService.send({
      type: NotificationType.EMAIL,
      target_email: email,
      title: 'Verify Your Email',
      message: `Your verification OTP is ${otp}. It will expire in 10 minutes.`,
    });

    // TODO: Remove OTP logging before production
    this.logger.warn(`[DEV] OTP for ${email}: ${otp}`);
  }

  private async validateAndConsumeOtp(
    email: string,
    otp: string,
  ): Promise<void> {
    const otpRecord = await this.otpRepository.findByIdentifierAndPurpose(
      email,
      OtpPurpose.LEAD_VERIFICATION,
    );

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (new Date() > otpRecord.expires_at) {
      await this.otpRepository.delete(otpRecord.id);
      throw new BadRequestException('OTP has expired');
    }

    const maxAttempts = this.configService.get<number>('otp.maxAttempts', 5);
    if (otpRecord.attempts_count >= maxAttempts) {
      await this.otpRepository.delete(otpRecord.id);
      throw new BadRequestException('Maximum OTP attempts exceeded');
    }

    const isDevBypass =
      this.configService.get<string>('brello.environment') === 'dev' &&
      otp === '123456';
    const isOtpValid =
      isDevBypass || (await this.verifyHash(otp, otpRecord.otp_hash));
    if (!isOtpValid) {
      await this.otpRepository.incrementAttempts(otpRecord.id);
      throw new BadRequestException('Invalid OTP');
    }

    await this.otpRepository.delete(otpRecord.id);
  }

  private async verifyLeadAndCreateUser(lead: Lead): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        // Mark lead as verified
        await manager.update(Lead, lead.id, { is_verified: true });

        // Create user from lead details
        const userRepo = manager.getRepository(User);
        const newUser = userRepo.create({
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone,
          password_hash: lead.password_hash,
          status: Status.ACTIVE,
          plan_id: lead.plan_id,
        });
        await userRepo.save(newUser);
      });
    } catch (error) {
      this.logger.error(
        `Failed to verify lead and create user for email: ${lead.email}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Verification failed. Please try again.',
      );
    }
  }
}
