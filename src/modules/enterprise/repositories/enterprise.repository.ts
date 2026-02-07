import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Enterprise } from '../entities/enterprise.entity';

// Enterprise Repository - Implements the Repository Pattern to encapsulate data access logic
@Injectable()
export class EnterpriseRepository {
    constructor(
        @InjectRepository(Enterprise)
        private readonly repository: Repository<Enterprise>,
    ) { }

    // Create a new enterprise
    async create(enterprise: Partial<Enterprise>): Promise<Enterprise> {
        const newEnterprise = this.repository.create(enterprise);
        return this.repository.save(newEnterprise);
    }

    // Find all enterprises
    async findAll(): Promise<Enterprise[]> {
        return this.repository.find({
            order: { created_at: 'DESC' },
        });
    }

    // Find enterprise by ID
    async findById(id: string): Promise<Enterprise | null> {
        return this.repository.findOne({ where: { id } });
    }

    // Find enterprise by domain
    async findByDomain(domain: string): Promise<Enterprise | null> {
        return this.repository.findOne({ where: { domain } });
    }

    // Update an enterprise
    async update(
        id: string,
        updateData: Partial<Enterprise>,
    ): Promise<Enterprise | null> {
        await this.repository.update(id, updateData);
        return this.findById(id);
    }

    // Delete an enterprise
    async delete(id: string): Promise<boolean> {
        const result = await this.repository.delete(id);
        return (result.affected ?? 0) > 0;
    }

    // Check if enterprise exists by ID
    async exists(id: string): Promise<boolean> {
        const count = await this.repository.count({ where: { id } });
        return count > 0;
    }
}
