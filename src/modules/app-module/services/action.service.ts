import { Injectable, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Action } from '../entities/action.entity';
import { ActionRepository } from '../repositories/action.repository';
import { CreateActionDto, UpdateActionDto } from '../dto/action.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class ActionService {
  private readonly logger = new Logger(ActionService.name);
 
  constructor(private readonly actionRepository: ActionRepository) {}

  async create(dto: CreateActionDto, user?: LoggedInUser): Promise<Action> {
    this.logger.log(`Creating action: ${dto.name}`);
    const action = this.actionRepository.create(dto);
    try {
      return await this.actionRepository.save(action);
    } catch (error) {
      throw new ConflictException(
        `Action with name "${dto.name}" may already exist.`,
      );
    }
  }

  async findAll(user?: LoggedInUser): Promise<Action[]> {
    return this.actionRepository.findAll();
  }

  async findOne(id: string, user?: LoggedInUser): Promise<Action> {
    const action = await this.actionRepository.findOneById(id);
    if (!action) {
      throw new NotFoundException(`Action with ID "${id}" not found`);
    }
    return action;
  }

  async update(id: string, dto: UpdateActionDto, user?: LoggedInUser): Promise<Action> {
    const action = await this.findOne(id, user);
    Object.assign(action, dto);
    return this.actionRepository.save(action);
  }

  async remove(id: string, user?: LoggedInUser): Promise<void> {
    await this.findOne(id, user);
    await this.actionRepository.softDelete(id);
  }
}
