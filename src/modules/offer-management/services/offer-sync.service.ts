import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { OfferRepository } from '../repositories/offer.repository';
import { OfferCandidateRepository } from '../repositories/offer-candidate.repository';
import { OfferTimelineRepository } from '../repositories/offer-timeline.repository';
import { EmployeeService } from '../../user/services/employee.service';
import { EmployeeSalaryEngine } from '../../payroll/services/employee-salary.service';
import { OfferStatus } from '../enums/offer-status.enum';
import { OfferTimelineEvent } from '../enums/offer-timeline-event.enum';
import { Status } from '../../../common/enums';
import { CreateEmployeeDto } from '../../user/dto';
import { UserType, EmploymentType, WorkLocation } from '../../user/enums/user.enum';
import { ComponentType, CalculationType } from '../../payroll/enums/payroll.enum';

// NOTE: no UserRepository / EmployeeSalaryRepository imports here — this service talks to
// the `user` and `payroll` modules only through their service interfaces (EmployeeService,
// EmployeeSalaryEngine), never their raw TypeORM repositories. Keeping this boundary clean
// is what lets offer-management be extracted into a standalone Recruitment Engine app later
// (see docs/offer-letter-Candidate Offer & Pre-Joining Management Platform-v1.md §25.4) —
// those service calls become outbound API calls at that point with no logic change here.

@Injectable()
export class OfferSyncService {
  private readonly logger = new Logger(OfferSyncService.name);

  constructor(
    private readonly offerRepo: OfferRepository,
    private readonly candidateRepo: OfferCandidateRepository,
    private readonly timelineRepo: OfferTimelineRepository,
    private readonly employeeService: EmployeeService,
    private readonly employeeSalaryEngine: EmployeeSalaryEngine,
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

    // Duplicate email/phone detection is not repeated here — EmployeeService.createEmployee()
    // already performs this check internally and throws ConflictException. Duplicating it via
    // a raw UserRepository lookup would mean offer-management reading another module's table
    // directly, which is exactly the coupling this service is meant to avoid (see note above).

    const generatedPassword = crypto.randomBytes(8).toString('hex');

    // 1. Map and Create Employee
    const createEmployeeDto: CreateEmployeeDto = {
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      email: candidate.email,
      phone: candidate.phone ?? undefined,
      password: generatedPassword,
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

    await this.assignSalaryFromOffer(offer, userId);
    await this.finalizeSync(offer, userId, 'Offer synced to create Employee record');

    this.logger.log(`Successfully synced offer ${offer.id} -> User ${userId}`);
    return { userId };
  }

  /**
   * Links an employee that was ALREADY created elsewhere (the full Add Employee wizard,
   * prefilled with this offer's data — see OfferDetailPage's "Sync to Employee" flow) back
   * to this offer, and assigns the offer's salary structure to them. Unlike syncToEmployee(),
   * this does not call EmployeeService.createEmployee() — the wizard already did, giving HR a
   * chance to review/complete every field (documents, bank info, education, etc.) the
   * auto-mapped syncToEmployee() path skips entirely.
   */
  async linkEmployeeAndAssignSalary(
    offerId: string,
    organizationId: string,
    employeeId: string,
  ): Promise<{ userId: string }> {
    const offer = await this.offerRepo.findOneByOrg(offerId, organizationId);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.offer_status !== OfferStatus.ACCEPTED) {
      throw new BadRequestException(
        `Offer cannot be synced. Current status is ${offer.offer_status}`,
      );
    }

    await this.assignSalaryFromOffer(offer, employeeId);
    await this.finalizeSync(
      offer,
      employeeId,
      'Offer synced — employee profile completed via onboarding wizard',
    );

    this.logger.log(`Successfully linked offer ${offer.id} -> User ${employeeId}`);
    return { userId: employeeId };
  }

  // Always via EmployeeSalaryEngine (payroll's own service), never by importing
  // EmployeeSalaryRepository/SalaryStructureBuilder here directly.
  private async assignSalaryFromOffer(
    offer: { enterprise_id: string; organization_id: string; salary_components: { name: string; amount: number; type: string }[] | null; ctc_annual: number | null; joining_date: string | Date | null; salary_structure_id: string | null },
    userId: string,
  ): Promise<void> {
    if (!offer.salary_components || offer.salary_components.length === 0) return;

    const ctc = Number(offer.ctc_annual ?? 0);
    const effectiveFromDate = offer.joining_date ? new Date(offer.joining_date) : new Date();

    if (offer.salary_structure_id) {
      const overrides: Record<string, number> = {};
      for (const c of offer.salary_components) {
        overrides[c.name] = Number(c.amount);
      }

      await this.employeeSalaryEngine.assignSalary(offer.enterprise_id, offer.organization_id, {
        user_id: userId,
        template_id: offer.salary_structure_id,
        ctc,
        effective_from: effectiveFromDate.toISOString(),
        overrides,
      });
    } else {
      // Offer has no salary template — build a flat component list and assign it ad-hoc.
      const components = offer.salary_components.map((c, i) => ({
        component_name: c.name,
        component_type: c.type as unknown as ComponentType,
        value: Number(c.amount),
        calculation_type: CalculationType.FIXED,
        is_residual: false,
        calculation_priority: i + 1,
      }));

      await this.employeeSalaryEngine.assignAdHocSalary(offer.enterprise_id, offer.organization_id, {
        user_id: userId,
        ctc,
        effective_from: effectiveFromDate,
        components,
      });
    }
  }

  private async finalizeSync(
    offer: { id: string; organization_id: string; enterprise_id: string },
    userId: string,
    label: string,
  ): Promise<void> {
    await this.offerRepo.update(offer.id, {
      offer_status: OfferStatus.SYNCED,
      synced_employee_id: userId,
    });

    await this.timelineRepo.record({
      offer_id: offer.id,
      event: OfferTimelineEvent.EMPLOYEE_SYNCED,
      label,
      organization_id: offer.organization_id,
      enterprise_id: offer.enterprise_id,
      actor_name: 'System / Admin',
    });
  }
}
