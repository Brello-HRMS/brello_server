import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Otp } from '../entities/otp.entity';
import { OtpPurpose } from '../../../common/enums';

// OTP Repository - Implements the Repository Pattern to encapsulate data access logic
@Injectable()
export class OtpRepository {
  constructor(
    @InjectRepository(Otp)
    private readonly repository: Repository<Otp>,
  ) {}

  // Create a new OTP
  async create(otp: Partial<Otp>): Promise<Otp> {
    const newOtp = this.repository.create(otp);
    return this.repository.save(newOtp);
  }

  async findAll() {
    return this.repository.find();
  }

  // Find OTP by identifier and purpose
  async findByIdentifierAndPurpose(
    identifier: string,
    purpose: OtpPurpose,
  ): Promise<Otp | null> {
    return this.repository.findOne({
      where: {
        identifier,
        purpose,
        // expires_at: LessThan(new Date()),
      },
      order: { created_at: 'DESC' },
    });
  }

  // Find OTP by ID
  async findById(id: string): Promise<Otp | null> {
    return this.repository.findOne({ where: { id } });
  }

  // Update OTP (e.g., increment attempts)
  async update(id: string, updateData: Partial<Otp>): Promise<Otp | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  // Increment attempt count
  async incrementAttempts(id: string): Promise<Otp | null> {
    const otp = await this.findById(id);
    if (otp) {
      return this.update(id, { attempts_count: otp.attempts_count + 1 });
    }
    return null;
  }

  // Delete OTP
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // Delete expired OTPs
  async deleteExpiredOtps(): Promise<number> {
    const result = await this.repository.delete({
      expires_at: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }

  // Delete all OTPs for an identifier
  async deleteByIdentifierAndPurpose(
    identifier: string,
    purpose: OtpPurpose,
  ): Promise<number> {
    const result = await this.repository.delete({ identifier, purpose });
    return result.affected || 0;
  }
}
