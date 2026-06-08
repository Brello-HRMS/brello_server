import { Injectable, NotFoundException } from '@nestjs/common';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { PayrollRunItemRepository } from '../repositories/payroll-run-item.repository';
import { PayrollAdjustmentRepository } from '../repositories/payroll-adjustment.repository';
import { PayrollRunService } from './payroll-run.service';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunItem } from '../entities/payroll-run-item.entity';

/**
 * Assembles payslip and report payloads from frozen run items. Returns plain JSON
 * (the frontend renders it; PDF generation is a later, additive phase).
 */
@Injectable()
export class PayslipService {
  constructor(
    private readonly itemRepo: PayrollRunItemRepository,
    private readonly adjustmentRepo: PayrollAdjustmentRepository,
    private readonly runService: PayrollRunService,
  ) {}

  /** Full payslip for one employee in a run (admin view). */
  async getPayslip(user: LoggedInUser, runId: string, itemId: string) {
    const run = await this.runService.getRun(user, runId);
    const item = await this.itemRepo.findById(user.organizationId, runId, itemId);
    if (!item) {
      throw new NotFoundException('Payroll item not found.');
    }
    const adjustments = await this.adjustmentRepo.listForUser(runId, item.user_id);
    return this.buildPayslip(run, item, adjustments);
  }

  /** Tabular summary of every employee in a run (export-ready rows). */
  async getReport(user: LoggedInUser, runId: string) {
    const run = await this.runService.getRun(user, runId);
    const items = await this.itemRepo.list(runId, { page: 1, limit: 10_000 });

    const rows = items.data.map((item) => ({
      employee_id: item.user_id,
      employee_name: fullName(item),
      status: item.item_status,
      working_days: item.total_working_days,
      present_days: item.present_days,
      paid_leave_days: item.paid_leave_days,
      lop_days: item.lop_days,
      gross: Number(item.gross),
      deductions: Number(item.deductions_total),
      reimbursements: Number(item.reimbursement_total),
      net: Number(item.net),
      employer_contribution: Number(item.employer_contribution),
    }));

    return {
      period: { month: run.month, year: run.year },
      run_status: run.run_status,
      totals: {
        total_employees: run.total_employees,
        total_gross: Number(run.total_gross),
        total_deductions: Number(run.total_deductions),
        total_net: Number(run.total_net),
        total_reimbursement: Number(run.total_reimbursement),
        total_employer_contribution: Number(run.total_employer_contribution),
      },
      rows,
    };
  }

  /** Logged-in employee's own payslips across locked runs (self-service). */
  async getMyPayslips(user: LoggedInUser) {
    const items = await this.itemRepo.findLockedForUser(
      user.organizationId,
      user.userId,
    );
    return items.map((item) => ({
      run_id: item.payroll_run_id,
      item_id: item.id,
      month: item.payroll_run?.month,
      year: item.payroll_run?.year,
      gross: Number(item.gross),
      deductions: Number(item.deductions_total),
      net: Number(item.net),
      locked_at: item.payroll_run?.locked_at,
    }));
  }

  private buildPayslip(
    run: PayrollRun,
    item: PayrollRunItem,
    adjustments: { adjustment_type: string; amount: number; reason: string | null }[],
  ) {
    const breakdown = item.calc_breakdown ?? { earnings: [], deductions: [] };
    return {
      period: { month: run.month, year: run.year },
      run_status: run.run_status,
      locked_at: run.locked_at,
      employee: {
        user_id: item.user_id,
        name: fullName(item),
      },
      attendance: {
        total_working_days: item.total_working_days,
        present_days: item.present_days,
        paid_leave_days: item.paid_leave_days,
        lop_days: item.lop_days,
      },
      earnings: breakdown.earnings ?? [],
      deductions: breakdown.deductions ?? [],
      adjustments: adjustments.map((a) => ({
        type: a.adjustment_type,
        amount: Number(a.amount),
        reason: a.reason,
      })),
      summary: {
        gross: Number(item.gross),
        deductions_total: Number(item.deductions_total),
        reimbursement_total: Number(item.reimbursement_total),
        bonus_total: Number(item.bonus_total),
        net: Number(item.net),
        employer_contribution: Number(item.employer_contribution),
      },
      item_status: item.item_status,
    };
  }
}

function fullName(item: PayrollRunItem): string {
  const u = item.user;
  if (!u) return '';
  return [u.first_name, u.last_name].filter(Boolean).join(' ');
}
