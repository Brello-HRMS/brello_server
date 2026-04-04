import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { CreatePayrollComponentDto } from '../dto/payroll-component.dto';

@Injectable()
export class ComponentMasterService {
  constructor(
    @InjectRepository(PayrollComponent)
    private readonly componentRepository: Repository<PayrollComponent>,
  ) {}

  async createComponent(
    enterpriseId: string,
    organizationId: string,
    dto: CreatePayrollComponentDto,
  ): Promise<PayrollComponent> {
    // Basic component is usually system-defined, user cannot define another 'Basic Salary' that is system defined
    if (dto.is_system_defined) {
      throw new BadRequestException(
        'Cannot create system-defined components manually.',
      );
    }

    const component = this.componentRepository.create({
      ...dto,
      enterprise_id: enterpriseId,
      organization_id: organizationId,
    });

    return this.componentRepository.save(component);
  }

  async updateComponent(
    id: string,
    dto: Partial<CreatePayrollComponentDto>,
  ): Promise<PayrollComponent> {
    const component = await this.componentRepository.findOne({ where: { id } });

    if (!component) {
      throw new NotFoundException(`Component with ID ${id} not found.`);
    }

    if (component.is_system_defined) {
      throw new BadRequestException(
        'System-defined components cannot be modified.',
      );
    }

    const updated = this.componentRepository.merge(component, dto as any);
    return this.componentRepository.save(updated);
  }

  async getAllComponents(
    enterpriseId: string,
    organizationId: string,
  ): Promise<PayrollComponent[]> {
    return this.componentRepository.find({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
    });
  }
}
