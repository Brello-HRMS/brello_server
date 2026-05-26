import { Injectable, BadRequestException } from '@nestjs/common';
import { BillingProfileRepository } from '../repositories/billing-profile.repository';
import { BillingProfile } from '../entities/billing-profile.entity';
import { OrganizationProfile } from '../../organization/entities/organization-profile.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Status } from 'src/common/enums';
import { UpsertBillingProfileDto } from '../dto/billing-profile.dto';

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9A-Z]{1}$/;
const PINCODE_REGEX = /^[0-9]{6}$/;

@Injectable()
export class BillingProfileService {
  constructor(
    private readonly repo: BillingProfileRepository,
    @InjectRepository(OrganizationProfile)
    private readonly orgProfileRepo: Repository<OrganizationProfile>,
  ) {}

  async getOrCreate(organizationId: string): Promise<BillingProfile> {
    const existing = await this.repo.findByOrg(organizationId);
    if (existing) return existing;

    // Seed from OrganizationProfile if available.
    const orgProfile = await this.orgProfileRepo.findOne({
      where: { organization_id: organizationId, status: Status.ACTIVE },
    });

    const fresh = this.repo.create({
      organization_id: organizationId,
      enterprise_id: orgProfile?.enterprise_id ?? undefined,
      legal_business_name: orgProfile?.name ?? null,
      gst_number: orgProfile?.gst_no ?? null,
      billing_address: orgProfile?.address ?? null,
      state: orgProfile?.state ?? null,
      country: orgProfile?.country ?? 'India',
      pincode: orgProfile?.zip_code ?? null,
      billing_email: orgProfile?.email ?? null,
    });
    return this.repo.save(fresh);
  }

  async upsert(
    organizationId: string,
    enterpriseId: string | null,
    dto: UpsertBillingProfileDto,
  ): Promise<BillingProfile> {
    const normalized = this.normalizeAndValidate(dto);
    const existing = await this.repo.findByOrg(organizationId);
    if (existing) {
      Object.assign(existing, normalized);
      return this.repo.save(existing);
    }
    const fresh = this.repo.create({
      organization_id: organizationId,
      enterprise_id: enterpriseId ?? undefined,
      ...normalized,
    });
    return this.repo.save(fresh);
  }

  private normalizeAndValidate(dto: UpsertBillingProfileDto): Partial<BillingProfile> {
    const gst = dto.gst_number ? dto.gst_number.toUpperCase().trim() : null;
    if (gst && !GST_REGEX.test(gst)) {
      throw new BadRequestException(
        'GST number format invalid. Expected 15-char GSTIN, e.g. 22AAAAA0000A1Z5',
      );
    }
    if (dto.pincode && !PINCODE_REGEX.test(dto.pincode)) {
      throw new BadRequestException('Pincode must be 6 digits');
    }
    return {
      legal_business_name: dto.legal_business_name?.trim() ?? null,
      gst_number: gst,
      billing_address: dto.billing_address?.trim() ?? null,
      state: dto.state?.trim() ?? null,
      country: dto.country?.trim() ?? 'India',
      pincode: dto.pincode?.trim() ?? null,
      billing_email: dto.billing_email?.trim() ?? null,
    };
  }
}
