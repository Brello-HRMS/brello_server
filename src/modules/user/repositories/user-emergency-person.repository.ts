import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { UserEmergencyPerson } from '../entities/user-emergency-person.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class UserEmergencyPersonRepository {
  constructor(
    @InjectRepository(UserEmergencyPerson)
    private readonly repository: Repository<UserEmergencyPerson>,
  ) {}

  async create(
    person: Partial<UserEmergencyPerson>,
  ): Promise<UserEmergencyPerson> {
    const newPerson = this.repository.create(person);
    return this.repository.save(newPerson);
  }

  async findById(id: string): Promise<UserEmergencyPerson | null> {
    return this.repository.findOne({
      where: { id, base_status: Not(Status.DELETED) },
    });
  }

  async update(
    id: string,
    updateData: Partial<UserEmergencyPerson>,
  ): Promise<UserEmergencyPerson | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      base_status: Status.DELETED,
    });
    return (result.affected ?? 0) > 0;
  }
}
