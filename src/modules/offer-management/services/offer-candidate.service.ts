import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { OfferCandidateRepository } from '../repositories/offer-candidate.repository';
import { OfferCandidate } from '../entities/offer-candidate.entity';
import {
  CreateOfferCandidateDto,
  UpdateOfferCandidateDto,
  FilterCandidatesDto,
} from '../dto/offer-candidate.dto';
import type { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class OfferCandidateService {
  constructor(private readonly candidateRepo: OfferCandidateRepository) {}

  async create(user: LoggedInUser, dto: CreateOfferCandidateDto): Promise<OfferCandidate> {
    await this.assertEmailUnique(dto.email, user.organizationId);
    return this.candidateRepo.create({
      ...dto,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
    });
  }

  async findAll(user: LoggedInUser, filters: FilterCandidatesDto): Promise<OfferCandidate[]> {
    return this.candidateRepo.findAllByOrg(user.organizationId, filters);
  }

  async findOne(user: LoggedInUser, id: string): Promise<OfferCandidate> {
    const candidate = await this.candidateRepo.findOneByOrg(id, user.organizationId);
    if (!candidate) throw new NotFoundException(`Candidate "${id}" not found`);
    return candidate;
  }

  async update(
    user: LoggedInUser,
    id: string,
    dto: UpdateOfferCandidateDto,
  ): Promise<OfferCandidate> {
    const existing = await this.findOne(user, id);

    if (dto.email && dto.email !== existing.email) {
      await this.assertEmailUnique(dto.email, user.organizationId);
    }

    const updated = await this.candidateRepo.update(id, {
      ...dto,
      modified_by: user.userId,
    });
    if (!updated) throw new NotFoundException(`Candidate "${id}" not found after update`);
    return updated;
  }

  private async assertEmailUnique(email: string, organizationId: string): Promise<void> {
    const existing = await this.candidateRepo.findByEmailAndOrg(email, organizationId);
    if (existing) {
      throw new ConflictException(`A candidate with email "${email}" already exists`);
    }
  }
}
