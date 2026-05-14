import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { CompanyPolicyRepository } from '../repositories/company-policy.repository';
import { CompanyPolicyTypeService } from './company-policy-type.service';
import { CompanyPolicy } from '../entities/company-policy.entity';
import { CreateCompanyPolicyDto, UpdateCompanyPolicyDto } from '../dto/company-policy.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { Status } from '../../../common/enums';
import { SearchIndexingService } from '../../global-search/services/search-indexing.service';

@Injectable()
export class CompanyPolicyService {
    private readonly logger = new Logger(CompanyPolicyService.name);

    constructor(
        private readonly policyRepository: CompanyPolicyRepository,
        private readonly typeService: CompanyPolicyTypeService,
        private readonly searchIndexingService: SearchIndexingService,
    ) { }

    async create(user: LoggedInUser, dto: CreateCompanyPolicyDto): Promise<CompanyPolicy> {
        this.logger.log(`Creating policy: ${dto.title} for org: ${user.organizationId}`);

        // Validate policy type
        const type = await this.typeService.findOne(user, dto.type_id);

        const policy = await this.policyRepository.create({
            ...dto,
            organization_id: user.organizationId,
            enterprise_id: user.enterpriseId,
            status: dto.status || Status.ACTIVE,
            modified_by: user.userId,
        });
        this.searchIndexingService.indexPolicy(policy, user.enterpriseId, user.organizationId);
        return policy;
    }

    async findAll(user: LoggedInUser, onlyActive: boolean = true): Promise<CompanyPolicy[]> {
        return this.policyRepository.findByOrg(
            user.organizationId,
            onlyActive ? Status.ACTIVE : undefined
        );
    }

    async findGrouped(user: LoggedInUser, onlyActive: boolean = true): Promise<any[]> {
        this.logger.log(`Fetching grouped policies for org: ${user.organizationId}`);
        const grouped = await this.policyRepository.findGroupedByOrg(
            user.organizationId,
            onlyActive
        );

        // Map the results to the requested format if needed
        return grouped.map(item => ({
            type_id: item.type_id,
            type_name: item.type_name,
            icon: item.icon,
            policy_count: parseInt(item.policy_count, 10),
            policies: item.policies,
        }));
    }

    async findOne(user: LoggedInUser, id: string, checkActive: boolean = true): Promise<CompanyPolicy> {
        const policy = await this.policyRepository.findOneById(id, user.organizationId);
        
        if (!policy) {
            throw new NotFoundException(`Policy with ID '${id}' not found`);
        }

        if (checkActive && policy.status !== Status.ACTIVE) {
            // Employees (default) should not see inactive policies
            throw new NotFoundException(`Policy with ID '${id}' not found`);
        }

        return policy;
    }

    async update(user: LoggedInUser, id: string, dto: UpdateCompanyPolicyDto): Promise<CompanyPolicy> {
        this.logger.log(`Updating policy: ${id} for org: ${user.organizationId}`);

        const policy = await this.findOne(user, id, false);

        if (dto.type_id) {
            await this.typeService.findOne(user, dto.type_id);
        }

        const updated = await this.policyRepository.update(id, {
            ...dto,
            modified_by: user.userId,
        });

        if (!updated) {
            throw new NotFoundException(`Policy with ID '${id}' not found after update`);
        }

        this.searchIndexingService.indexPolicy(updated, user.enterpriseId, user.organizationId);
        return updated;
    }

    async remove(user: LoggedInUser, id: string): Promise<void> {
        this.logger.log(`Soft-deleting policy: ${id} for org: ${user.organizationId}`);
        await this.findOne(user, id, false);
        await this.policyRepository.softDelete(id, user.userId);
        this.searchIndexingService.removePolicy(id, user.enterpriseId);
    }
}
