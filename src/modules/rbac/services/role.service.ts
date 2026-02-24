import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';

@Injectable()
export class RoleService {
    constructor(
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
    ) { }

    async create(dto: CreateRoleDto): Promise<Role> {
        const role = this.roleRepository.create(dto);
        return this.roleRepository.save(role);
    }

    async findAll(): Promise<Role[]> {
        return this.roleRepository.find({
            relations: ['app'],
            order: { created_at: 'DESC' },
        });
    }

    async findOne(id: string): Promise<Role> {
        const role = await this.roleRepository.findOne({
            where: { id },
            relations: ['app'],
        });
        if (!role) {
            throw new NotFoundException(`Role with ID "${id}" not found`);
        }
        return role;
    }

    async findByAppId(appId: string): Promise<Role[]> {
        return this.roleRepository.find({
            where: { app_id: appId },
            relations: ['app'],
            order: { name: 'ASC' },
        });
    }

    async update(id: string, dto: UpdateRoleDto): Promise<Role> {
        const role = await this.findOne(id);
        Object.assign(role, dto);
        return this.roleRepository.save(role);
    }

    async remove(id: string): Promise<void> {
        const role = await this.findOne(id);
        await this.roleRepository.remove(role);
    }
}
