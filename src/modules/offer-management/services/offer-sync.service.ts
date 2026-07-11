import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { OfferRepository } from '../repositories/offer.repository';
import { OfferCandidateRepository } from '../repositories/offer-candidate.repository';
import { OfferTimelineRepository } from '../repositories/offer-timeline.repository';
import { EmployeeService } from '../../user/services/employee.service';
import { EmployeeSalaryRepository } from '../../payroll/repositories/employee-salary.repository';
import { OfferStatus } from '../enums/offer-status.enum';
import { OfferTimelineEvent } from '../enums/offer-timeline-event.enum';
import { Status } from '../../../common/enums';
import { CreateEmployeeDto } from '../../user/dto';
import { UserType, EmploymentType, WorkLocation } from '../../user/enums/user.enum';
import { ComponentType, CalculationType } from '../../payroll/enums/payroll.enum';

@Injectable()
export class OfferSyncService {
  private readonly logger = new Logger(OfferSyncService.name);

  constructor(
    private readonly offerRepo: OfferRepository,
    private readonly candidateRepo: OfferCandidateRepository,
    private readonly timelineRepo: OfferTimelineRepository,
    private readonly employeeService: EmployeeService,
    private readonly salaryRepo: EmployeeSalaryRepository,
  ) {}

  async syncToEmployee(
    offerId: string,
    organizationId: string,
    actorId: string,
  ): Promise<{ userId: string }> {
    this.logger.log(`Syncing offer ${offerId} to employee record...`);

    const offer = await this.offerRepo.findOneByOrg(offerId, organizationId);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.offer_status !== OfferStatus.ACCEPTED) {
      throw new BadRequestException(
        `Offer cannot be synced. Current status is ${offer.offer_status}`,
      );
    }

    const candidate = await this.candidateRepo.findOneByOrg(
      offer.candidate_id,
      organizationId,
    );

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    // 1. Map and Create Employee
    const createEmployeeDto: CreateEmployeeDto = {
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      email: candidate.email,
      phone: candidate.phone ?? undefined,
      // Default empty password implies the user will use "Forgot Password" or invite link later
      password: '',
      departmentId: offer.department_id ?? undefined,
      designationId: offer.designation_id ?? undefined,
      enterprise_id: offer.enterprise_id,
      organization_id: offer.organization_id,
      profile: {
        type: UserType.EMPLOYEE,
        joiningDate: offer.joining_date ? new Date(offer.joining_date).toISOString() : undefined,
        employmentType: offer.employment_type as unknown as EmploymentType,
        workLocation: offer.work_mode as unknown as WorkLocation,
        noticePeriod: offer.notice_period_days ?? 30,
        currentSalary: offer.ctc_annual?.toString(),
      },
    };

    const { id: userId } = await this.employeeService.createEmployee(
      createEmployeeDto,
      offer.enterprise_id,
      offer.organization_id,
      actorId,
    );

    // 2. Map and Create Salary Structure
    if (offer.salary_components && offer.salary_components.length > 0) {
      await this.salaryRepo.createNewVersion({
        user_id: userId,
        ctc: Number(offer.ctc_annual ?? 0),
        effective_from: offer.joining_date ?? new Date(),
        enterprise_id: offer.enterprise_id,
        organization_id: offer.organization_id,
        components: offer.salary_components.map((c, i) => ({
          component_name: c.name,
          component_type: c.type as unknown as ComponentType,
          value: Number(c.amount),
          calculation_type: CalculationType.FIXED, // Simplifying mapping for MVP
          is_residual: false,
          calculation_priority: i + 1,
        })),
      });
    }

    // 3. Update Offer Status
    await this.offerRepo.update(offer.id, {
      offer_status: OfferStatus.SYNCED,
    });

    await this.timelineRepo.record({
      offer_id: offer.id,
      event: OfferTimelineEvent.EMPLOYEE_SYNCED,
      label: 'Offer synced to create Employee record',
      organization_id: offer.organization_id,
      enterprise_id: offer.enterprise_id,
      actor_name: 'System / Admin',
    });

    this.logger.log(`Successfully synced offer ${offer.id} -> User ${userId}`);
    return { userId };
  }
}
