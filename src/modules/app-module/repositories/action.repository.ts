import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Action } from '../entities/action.entity';

@Injectable()
export class ActionRepository {
  constructor(
    @InjectRepository(Action)
    private readonly repository: Repository<Action>,
  ) {}

  create(data: Partial<Action>): Action {
    return this.repository.create(data);
  }

  async save(action: Action): Promise<Action> {
    return this.repository.save(action);
  }

  async findAll(): Promise<Action[]> {
    return this.repository.find({
      order: { name: 'ASC' },
      where: { status: 'ACTIVE' as any },
    });
  }

  async findOneById(id: string): Promise<Action> {
    const action = await this.repository.findOne({
      where: { id, status: 'ACTIVE' as any },
    });
    if (!action) {
      throw new NotFoundException(`Action with ID "${id}" not found`);
    }
    return action;
  }


  async findByName(name: string): Promise<Action | null> {
    return this.repository.findOne({
      where: { name, status: 'ACTIVE' as any },
    });
  }

  async findByCode(code: string): Promise<Action | null> {
    return this.repository.findOne({
      where: { code: code.toLowerCase(), status: 'ACTIVE' as any },
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      status: 'DELETED' as any,
    });
    return (result.affected ?? 0) > 0;
  }

  async syncActionsCodeAndName(): Promise<void> {
    console.log('--- DB SYNC: Running Action Code/Name Sync (QueryBuilder) ---');
    try {
      // 1. Update all actions where code is not set or inconsistent
      const actions = await this.repository.find();
      
      for (const action of actions) {
        let changed = false;
        const correctCode = action.name.toLowerCase();
        const correctName = action.name.charAt(0).toUpperCase() + action.name.slice(1).toLowerCase();

        if (action.code !== correctCode) {
          action.code = correctCode;
          changed = true;
        }
        if (action.name !== correctName) {
          action.name = correctName;
          changed = true;
        }

        if (changed) {
          await this.repository.save(action);
        }
      }
      
      console.log('--- DB SYNC: Completed Successfully (Standardized All Actions) ---');
    } catch (err) {
      console.error('--- DB SYNC: FAILED ---');
      console.error(err);
    }
  }
}
