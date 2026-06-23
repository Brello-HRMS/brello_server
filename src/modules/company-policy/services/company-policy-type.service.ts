import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { CompanyPolicyTypeRepository } from '../repositories/company-policy-type.repository';
import { CompanyPolicyRepository } from '../repositories/company-policy.repository';
import { CompanyPolicyType } from '../entities/company-policy-type.entity';
import { CreateCompanyPolicyTypeDto, UpdateCompanyPolicyTypeDto } from '../dto/policy-type.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { Status } from '../../../common/enums';
import { AuditContextService } from '../../audit/services/audit-context.service';

@Injectable()
export class CompanyPolicyTypeService {
    private readonly logger = new Logger(CompanyPolicyTypeService.name);

    constructor(
        private readonly typeRepository: CompanyPolicyTypeRepository,
        private readonly policyRepository: CompanyPolicyRepository,
        private readonly auditContext: AuditContextService,
    ) { }

    async findAll(user: LoggedInUser): Promise<CompanyPolicyType[]> {
        this.logger.log(`Listing policy types for org: ${user.organizationId}`);
        return this.typeRepository.findActiveByOrg(user.organizationId);
    }

    async create(user: LoggedInUser, dto: CreateCompanyPolicyTypeDto): Promise<CompanyPolicyType> {
        this.logger.log(`Creating custom policy type: ${dto.name} for org: ${user.organizationId}`);

        const existing = await this.typeRepository.findByName(dto.name, user.organizationId);
        if (existing) {
            throw new ConflictException(`Policy type with name '${dto.name}' already exists`);
        }

        return this.typeRepository.create({
            ...dto,
            organization_id: user.organizationId,
            enterprise_id: user.enterpriseId,
            is_system: false,
            status: dto.status || Status.ACTIVE,
            modified_by: user.userId,
        });
    }

    async update(user: LoggedInUser, id: string, dto: UpdateCompanyPolicyTypeDto): Promise<CompanyPolicyType> {
        const type = await this.findOne(user, id);
        this.auditContext.setPreValue(type as unknown as Record<string, unknown>);

        if (type.is_system) {
            throw new BadRequestException('System policy types cannot be modified');
        }

        // Check if deactivating while policies exist
        if (dto.status === Status.INACTIVE || dto.status === Status.DELETED) {
            const policyCount = await this.policyRepository.countByTypeId(id);
            if (policyCount > 0) {
                throw new BadRequestException('Cannot deactivate policy type while active policies are linked to it');
            }
        }

        const updated = await this.typeRepository.update(id, {
            ...dto,
            modified_by: user.userId,
        });

        if (!updated) {
            throw new NotFoundException(`Policy type with ID '${id}' not found`);
        }

        return updated;
    }

    async remove(user: LoggedInUser, id: string): Promise<void> {
        const type = await this.findOne(user, id);
        this.auditContext.setPreValue(type as unknown as Record<string, unknown>);

        if (type.is_system) {
            throw new BadRequestException('System policy types cannot be deleted');
        }

        const policyCount = await this.policyRepository.countByTypeId(id);
        if (policyCount > 0) {
            throw new BadRequestException('Cannot delete policy type while active policies are linked to it');
        }

        await this.typeRepository.softDelete(id, user.userId);
    }

    async findOne(user: LoggedInUser, id: string): Promise<CompanyPolicyType> {
        const type = await this.typeRepository.findOneById(id);
        if (!type || (type.organization_id !== user.organizationId && !type.is_system)) {
            throw new NotFoundException(`Policy type with ID '${id}' not found`);
        }
        return type;
    }
}
