import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { Reimbursement } from '../../reimbursement/entities/reimbursement.entity';
import { ReimbursementStatus } from '../../reimbursement/enums/reimbursement.enum';

/**
 * Payroll's view of reimbursements. Reads approved, not-yet-processed claims to
 * fold into net pay, and stamps them with the run id so they are consumed exactly
 * once. Re-processing the same run re-includes its own previously-stamped claims.
 */
@Injectable()
export class PayrollReimbursementRepository {
  constructor(
    @InjectRepository(Reimbursement)
    private readonly repo: Repository<Reimbursement>,
  ) {}

  /** Approved claims for an employee that are unprocessed or already tied to this run. */
  async findIncludable(
    organizationId: string,
    employeeId: string,
    runId: string,
  ): Promise<Reimbursement[]> {
    return this.repo.find({
      where: [
        {
          organization_id: organizationId,
          employee_id: employeeId,
          reimb_status: ReimbursementStatus.APPROVED,
          processed_in_payroll_id: IsNull(),
        },
        {
          organization_id: organizationId,
          employee_id: employeeId,
          reimb_status: ReimbursementStatus.APPROVED,
          processed_in_payroll_id: runId,
        },
      ],
    });
  }

  /** Links claims to a run (consumed during processing). */
  async stampProcessed(ids: string[], runId: string): Promise<void> {
    if (!ids.length) return;
    await this.repo.update({ id: In(ids) }, { processed_in_payroll_id: runId });
  }

  /** Marks all claims tied to a run as paid (called when the run is locked). */
  async markPaidForRun(runId: string, paidAt: Date): Promise<void> {
    await this.repo.update(
      { processed_in_payroll_id: runId, is_paid: false },
      { is_paid: true, paid_at: paidAt },
    );
  }

  /** Releases claims previously tied to a run (used when an item drops to error). */
  async releaseForUser(
    organizationId: string,
    employeeId: string,
    runId: string,
  ): Promise<void> {
    await this.repo.update(
      {
        organization_id: organizationId,
        employee_id: employeeId,
        processed_in_payroll_id: runId,
      },
      { processed_in_payroll_id: null as unknown as string },
    );
  }
}
