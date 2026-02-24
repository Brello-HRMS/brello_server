import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleMap } from '../entities/user-role-map.entity';
import { CreateUserRoleMapDto } from '../dto/create-user-role-map.dto';

@Injectable()
export class UserRoleMapService {
    constructor(
        @InjectRepository(UserRoleMap)
        private readonly userRoleMapRepository: Repository<UserRoleMap>,
    ) { }

    async create(dto: CreateUserRoleMapDto): Promise<UserRoleMap> {
        // Check for duplicate assignment
        const existing = await this.userRoleMapRepository.findOne({
            where: {
                user_id: dto.user_id,
                role_id: dto.role_id,
                organization_id: dto.organization_id,
            },
        });
        if (existing) {
            throw new ConflictException('This role is already assigned to the user in this organization');
        }

        const mapping = this.userRoleMapRepository.create(dto);
        return this.userRoleMapRepository.save(mapping);
    }

    async findAll(): Promise<UserRoleMap[]> {
        return this.userRoleMapRepository.find({
            relations: ['role', 'role.app'],
            order: { created_at: 'DESC' },
        });
    }

    async findByUserId(userId: string): Promise<UserRoleMap[]> {
        return this.userRoleMapRepository.find({
            where: { user_id: userId },
            relations: ['role', 'role.app'],
            order: { created_at: 'DESC' },
        });
    }

    async findOne(id: string): Promise<UserRoleMap> {
        const mapping = await this.userRoleMapRepository.findOne({
            where: { id },
            relations: ['role', 'role.app'],
        });
        if (!mapping) {
            throw new NotFoundException(`UserRoleMap with ID "${id}" not found`);
        }
        return mapping;
    }

    async remove(id: string): Promise<void> {
        const mapping = await this.findOne(id);
        await this.userRoleMapRepository.remove(mapping);
    }
}
