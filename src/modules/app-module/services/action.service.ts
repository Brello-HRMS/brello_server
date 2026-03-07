import { Injectable, ConflictException } from '@nestjs/common';
import { Action } from '../entities/action.entity';
import { ActionRepository } from '../repositories/action.repository';
import { CreateActionDto, UpdateActionDto } from '../dto/action.dto';

@Injectable()
export class ActionService {
  constructor(private readonly actionRepository: ActionRepository) {}

  async create(dto: CreateActionDto): Promise<Action> {
    const action = this.actionRepository.create(dto);
    try {
      return await this.actionRepository.save(action);
    } catch (error) {
      throw new ConflictException(
        `Action with name "${dto.name}" may already exist.`,
      );
    }
  }

  async findAll(): Promise<Action[]> {
    return this.actionRepository.findAll();
  }

  async findOne(id: string): Promise<Action> {
    return this.actionRepository.findOneById(id);
  }

  async update(id: string, dto: UpdateActionDto): Promise<Action> {
    const action = await this.findOne(id);
    Object.assign(action, dto);
    return this.actionRepository.save(action);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.actionRepository.softDelete(id);
  }
}
