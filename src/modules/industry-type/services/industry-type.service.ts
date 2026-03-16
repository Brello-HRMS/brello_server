import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { IndustryTypeRepository } from '../repositories/industry-type.repository';
import { CreateIndustryTypeDto } from '../dto/create-industry-type.dto';
import { UpdateIndustryTypeDto } from '../dto/update-industry-type.dto';
import { IndustryType } from '../entities/industry-type.entity';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class IndustryTypeService {
  private readonly logger = new Logger(IndustryTypeService.name);

  constructor(
    private readonly industryTypeRepository: IndustryTypeRepository,
  ) {}

  async create(
    createIndustryTypeDto: CreateIndustryTypeDto,
    user?: LoggedInUser,
  ): Promise<IndustryType> {
    this.logger.log(`Creating industry type: ${createIndustryTypeDto.name}`);

    const existingType = await this.industryTypeRepository.findByName(
      createIndustryTypeDto.name,
    );
    if (existingType) {
      throw new ConflictException(
        `Industry type with name '${createIndustryTypeDto.name}' already exists`,
      );
    }

    const industryType = await this.industryTypeRepository.create(
      createIndustryTypeDto,
    );
    this.logger.log(`Industry type created successfully: ${industryType.id}`);

    return industryType;
  }

  async findAll(user?: LoggedInUser): Promise<IndustryType[]> {
    this.logger.log('Fetching all active industry types');
    return this.industryTypeRepository.findAll();
  }

  async findOne(id: string, user?: LoggedInUser): Promise<IndustryType> {
    this.logger.log(`Fetching industry type: ${id}`);

    const industryType = await this.industryTypeRepository.findById(id);
    if (!industryType) {
      throw new NotFoundException(`Industry type with ID '${id}' not found`);
    }

    return industryType;
  }

  async update(
    id: string,
    updateIndustryTypeDto: UpdateIndustryTypeDto,
    user?: LoggedInUser,
  ): Promise<IndustryType> {
    this.logger.log(`Updating industry type: ${id}`);
 
    await this.findOne(id, user);

    if (updateIndustryTypeDto.name) {
      const existingType = await this.industryTypeRepository.findByName(
        updateIndustryTypeDto.name,
      );
      if (existingType && existingType.id !== id) {
        throw new ConflictException(
          `Industry type with name '${updateIndustryTypeDto.name}' already exists`,
        );
      }
    }

    const updatedIndustryType = await this.industryTypeRepository.update(
      id,
      updateIndustryTypeDto,
    );
    if (!updatedIndustryType) {
      throw new NotFoundException(
        `Industry type with ID '${id}' not found after update`,
      );
    }

    this.logger.log(`Industry type updated successfully: ${id}`);
    return updatedIndustryType;
  }

  async remove(id: string, user?: LoggedInUser): Promise<void> {
    this.logger.log(`Soft deleting industry type: ${id}`);
 
    await this.findOne(id, user);

    const deleted = await this.industryTypeRepository.softDelete(id);
    if (!deleted) {
      throw new NotFoundException(
        `Failed to delete industry type with ID '${id}'`,
      );
    }

    this.logger.log(`Industry type soft deleted successfully: ${id}`);
  }
}
