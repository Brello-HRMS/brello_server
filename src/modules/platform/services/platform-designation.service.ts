import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Designation } from '../../designations/entities/designation.entity';
import { Status } from '../../../common/enums';
import { CreatePlatformDesignationDto } from '../dto/create-platform-designation.dto';
import { UpdatePlatformDesignationDto } from '../dto/update-platform-designation.dto';

@Injectable()
export class PlatformDesignationService {
  constructor(
    @InjectRepository(Designation)
    private readonly designationRepository: Repository<Designation>,
  ) {}

  async findAll(): Promise<Designation[]> {
    return this.designationRepository.find({
      where: { is_default: true, is_deleted: false, org_id: IsNull() },
      order: { title: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Designation> {
    const designation = await this.designationRepository.findOne({
      where: { id, is_default: true, is_deleted: false },
    });
    if (!designation) {
      throw new NotFoundException(`Default designation with id '${id}' not found`);
    }
    return designation;
  }

  async create(createDto: CreatePlatformDesignationDto): Promise<Designation> {
    const existingDesignation = await this.designationRepository.findOne({
      where: {
        code: createDto.code.toUpperCase(),
        is_default: true,
        is_deleted: false,
        org_id: IsNull(),
      },
    });
    if (existingDesignation) {
      throw new ConflictException(`A default designation with code '${createDto.code}' already exists`);
    }

    const newDesignation = this.designationRepository.create({
      ...createDto,
      code: createDto.code.toUpperCase(),
      status: createDto.status ?? Status.ACTIVE,
      is_default: true,
      is_deleted: false,
      org_id: null,
    });
    return this.designationRepository.save(newDesignation);
  }

  async update(id: string, updateDto: UpdatePlatformDesignationDto): Promise<Designation> {
    const designation = await this.findOne(id);
    Object.assign(designation, updateDto);
    return this.designationRepository.save(designation);
  }

  async remove(id: string): Promise<void> {
    const designation = await this.findOne(id);
    designation.is_deleted = true;
    designation.status = Status.DELETED;
    await this.designationRepository.save(designation);
  }
}
