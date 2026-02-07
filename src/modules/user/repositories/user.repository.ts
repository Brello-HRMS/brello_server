import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { User } from '../entities/user.entity';
import { Status } from '../../../common/enums';

// User Repository - Implements the Repository Pattern to encapsulate data access logic
@Injectable()
export class UserRepository {
    constructor(
        @InjectRepository(User)
        private readonly repository: Repository<User>,
    ) { }

    // Create a new user
    async create(user: Partial<User>): Promise<User> {
        const newUser = this.repository.create(user);
        return this.repository.save(newUser);
    }

    // Find all users (excluding deleted)
    async findAll(): Promise<User[]> {
        return this.repository.find({
            where: { status: Not(Status.DELETED) },
            order: { created_at: 'DESC' },
        });
    }

    // Find user by ID
    async findById(id: string): Promise<User | null> {
        return this.repository.findOne({
            where: { id, status: Not(Status.DELETED) },
        });
    }

    // Find user by email
    async findByEmail(email: string): Promise<User | null> {
        return this.repository.findOne({
            where: { email, status: Not(Status.DELETED) },
        });
    }

    // Find user by phone
    async findByPhone(phone: string): Promise<User | null> {
        return this.repository.findOne({
            where: { phone, status: Not(Status.DELETED) },
        });
    }

    // Find users by enterprise ID
    async findByEnterpriseId(enterpriseId: string): Promise<User[]> {
        return this.repository.find({
            where: { enterprise_id: enterpriseId, status: Not(Status.DELETED) },
            order: { created_at: 'DESC' },
        });
    }

    // Find users by organization ID
    async findByOrganizationId(organizationId: string): Promise<User[]> {
        return this.repository.find({
            where: { organization_id: organizationId, status: Not(Status.DELETED) },
            order: { created_at: 'DESC' },
        });
    }

    // Update a user
    async update(id: string, updateData: Partial<User>): Promise<User | null> {
        await this.repository.update(id, updateData);
        return this.findById(id);
    }

    // Soft delete a user (set status to DELETED)
    async softDelete(id: string): Promise<User | null> {
        await this.repository.update(id, { status: Status.DELETED });
        return this.findById(id);
    }

    // Hard delete a user (physical deletion)
    async delete(id: string): Promise<boolean> {
        const result = await this.repository.delete(id);
        return (result.affected ?? 0) > 0;
    }

    // Check if user exists by ID
    async exists(id: string): Promise<boolean> {
        const count = await this.repository.count({
            where: { id, status: Not(Status.DELETED) },
        });
        return count > 0;
    }

    // Check if email exists (excluding specific user ID)
    async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
        const where: any = { email, status: Not(Status.DELETED) };
        if (excludeUserId) {
            where.id = Not(excludeUserId);
        }
        const count = await this.repository.count({ where });
        return count > 0;
    }

    // Check if phone exists (excluding specific user ID)
    async phoneExists(phone: string, excludeUserId?: string): Promise<boolean> {
        const where: any = { phone, status: Not(Status.DELETED) };
        if (excludeUserId) {
            where.id = Not(excludeUserId);
        }
        const count = await this.repository.count({ where });
        return count > 0;
    }
}
