import { RestrictedOnExpiry } from '../../billing/decorators/restricted-on-expiry.decorator';
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PayrollService } from '../services/payroll.service';
import { ComponentMasterService } from '../services/component-master.service';
import { PfConfigService } from '../services/pf-config.service';
import { SalaryTemplateEngine } from '../services/salary-template.service';
import { EmployeeSalaryEngine } from '../services/employee-salary.service';
import { DryRunEngine } from '../services/dry-run.service';
import { ChangePropagationService } from '../services/change-propagation.service';

import { CreatePayrollSettingDto } from '../dto/payroll-setting.dto';
import {
  CreatePayrollComponentDto,
  UpdatePayrollComponentDto,
} from '../dto/payroll-component.dto';
import { UpsertPfConfigDto } from '../dto/pf-config.dto';
import { CreateSalaryTemplateDto } from '../dto/salary-template.dto';
import {
  AssignEmployeeSalaryDto,
  BulkAssignEmployeeSalaryDto,
  UpdateEmployeeSalaryDto,
  PropagationApplyDto,
} from '../dto/employee-salary.dto';
import { EmployeeQueryDto } from '../dto/employee-listing.dto';
import { DryRunDto } from '../dto/dry-run.dto';

import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

interface AuthPayload {
  enterpriseId: string;
  organizationId: string;
  userId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('payroll')
@RestrictedOnExpiry()
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly componentMasterService: ComponentMasterService,
    private readonly pfConfigService: PfConfigService,
    private readonly salaryTemplateEngine: SalaryTemplateEngine,
    private readonly employeeSalaryEngine: EmployeeSalaryEngine,
    private readonly dryRunEngine: DryRunEngine,
    private readonly changePropagationService: ChangePropagationService,
  ) {}

  // ─── Payroll Settings ───────────────────────────────────────────────────────

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.UPDATE, 'payroll_config')
  @Put('configurations')
  updateSettings(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreatePayrollSettingDto,
  ) {
    return this.payrollService.createOrUpdateSetting(
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  @Get('configurations')
  getSettings(@CurrentUser() user: AuthPayload) {
    return this.payrollService.getSetting(user.enterpriseId, user.organizationId);
  }

  // ─── Component Master ────────────────────────────────────────────────────────

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.CREATE, 'payroll_component')
  @Post('component-master')
  createComponent(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreatePayrollComponentDto,
  ) {
    return this.componentMasterService.createComponent(
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  @Get('component-master')
  getAllComponents(@CurrentUser() user: AuthPayload) {
    return this.componentMasterService.getAllComponents(
      user.enterpriseId,
      user.organizationId,
    );
  }

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.UPDATE, 'payroll_component')
  @Put('component-master/:id')
  updateComponent(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollComponentDto,
  ) {
    return this.componentMasterService.updateComponent(id, dto);
  }

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.DELETE, 'payroll_component')
  @Delete('component-master/:id')
  deleteComponent(@Param('id') id: string) {
    return this.componentMasterService.deleteComponent(id);
  }

  // ─── PF Configuration ────────────────────────────────────────────────────────

  @AuditLog(AuditLogModule.PAYROLL, AuditAction.UPDATE, 'pf_config')
  @Put('statutory-pf-config')
  updatePfConfig(
    @CurrentUser() user: AuthPayload,
    @Body() dto: UpsertPfConfigDto,
  ) {
    return this.pfConfigService.upsertConfig(
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  @Get('statutory-pf-config')
  getPfConfig(@CurrentUser() user: AuthPayload) {
    return this.pfConfigService.getConfig(user.enterpriseId, user.organizationId);
  }

  @Get('statutory-pf-config/history')
  getPfConfigHistory(@CurrentUser() user: AuthPayload) {
    return this.pfConfigService.getHistory(user.enterpriseId, user.organizationId);
  }

  // ─── Salary Templates ────────────────────────────────────────────────────────

  @AuditLog(AuditLogModule.SALARY, AuditAction.CREATE, 'salary_template')
  @Post('salary-templates')
  createTemplate(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateSalaryTemplateDto,
  ) {
    return this.salaryTemplateEngine.createTemplate(
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  @Get('salary-templates')
  getAllTemplates(@CurrentUser() user: AuthPayload) {
    return this.salaryTemplateEngine.getAllTemplates(
      user.enterpriseId,
      user.organizationId,
    );
  }

  @Get('salary-templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.salaryTemplateEngine.getTemplateById(id);
  }

  @AuditLog(AuditLogModule.SALARY, AuditAction.UPDATE, 'salary_template')
  @Put('salary-templates/:id')
  updateTemplate(
    @CurrentUser() user: AuthPayload,
    @Param('id') id: string,
    @Body() dto: CreateSalaryTemplateDto,
  ) {
    return this.salaryTemplateEngine.updateTemplate(
      user.enterpriseId,
      user.organizationId,
      id,
      dto,
    );
  }

  @AuditLog(AuditLogModule.SALARY, AuditAction.DELETE, 'salary_template')
  @Delete('salary-templates/:id')
  @HttpCode(204)
  deleteTemplate(@Param('id') id: string) {
    return this.salaryTemplateEngine.deleteTemplate(id);
  }

  // ─── Dry Run ─────────────────────────────────────────────────────────────────

  @Post('simulations/dry-run')
  @HttpCode(200)
  dryRun(@CurrentUser() user: AuthPayload, @Body() dto: DryRunDto) {
    return this.dryRunEngine.simulate(user.enterpriseId, user.organizationId, dto);
  }

  // ─── Employee Salary ─────────────────────────────────────────────────────────

  @AuditLog(AuditLogModule.SALARY, AuditAction.ASSIGN, 'salary_assignment')
  @Post('employee-salary-assignments')
  assignSalary(
    @CurrentUser() user: AuthPayload,
    @Body() dto: AssignEmployeeSalaryDto,
  ) {
    return this.employeeSalaryEngine.assignSalary(
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  @AuditLog(AuditLogModule.SALARY, AuditAction.ASSIGN, 'salary_assignment')
  @Post('employee-salary-assignments/bulk')
  bulkAssignSalary(
    @CurrentUser() user: AuthPayload,
    @Body() dto: BulkAssignEmployeeSalaryDto,
  ) {
    return this.employeeSalaryEngine.bulkAssignSalary(
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  @Get('employees')
  getEmployeesList(
    @CurrentUser() user: AuthPayload,
    @Query() query: EmployeeQueryDto,
  ) {
    return this.employeeSalaryEngine.getEmployeesList(
      user.enterpriseId,
      user.organizationId,
      query,
    );
  }

  @Get('employees/:userId/salary')
  getEmployeeSalaryStructure(@Param('userId') userId: string) {
    return this.employeeSalaryEngine.getEmployeeSalaryStructure(userId);
  }

  @AuditLog(AuditLogModule.SALARY, AuditAction.UPDATE, 'employee_salary', { entityIdParam: 'userId' })
  @Put('employees/:userId/salary')
  updateEmployeeSalaryStructure(
    @CurrentUser() user: AuthPayload,
    @Param('userId') userId: string,
    @Body() dto: UpdateEmployeeSalaryDto,
  ) {
    return this.employeeSalaryEngine.updateEmployeeSalaryStructure(
      user.enterpriseId,
      user.organizationId,
      userId,
      dto,
    );
  }

  @Get('employees/:userId/salary/history')
  getEmployeeSalaryHistory(@Param('userId') userId: string) {
    return this.employeeSalaryEngine.getEmployeeSalaryHistory(userId);
  }

  // ─── Change Propagation ──────────────────────────────────────────────────────

  @Get('propagation/preview')
  getPropagationPreview(
    @CurrentUser() user: AuthPayload,
    @Query('component_id') componentId: string,
  ) {
    return this.changePropagationService.previewImpact(
      user.enterpriseId,
      user.organizationId,
      componentId,
    );
  }

  @AuditLog(AuditLogModule.SALARY, AuditAction.UPDATE, 'salary_propagation')
  @Post('propagation/apply')
  @HttpCode(200)
  applyPropagation(
    @CurrentUser() user: AuthPayload,
    @Body() dto: PropagationApplyDto,
  ) {
    return this.changePropagationService.applyPropagation(
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }
}
