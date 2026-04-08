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

import { CreatePayrollSettingDto } from '../dto/payroll-setting.dto';
import { CreatePayrollComponentDto } from '../dto/payroll-component.dto';
import { UpsertPfConfigDto } from '../dto/pf-config.dto';
import { CreateSalaryTemplateDto } from '../dto/salary-template.dto';
import {
  AssignEmployeeSalaryDto,
  UpdateEmployeeSalaryDto,
} from '../dto/employee-salary.dto';
import { EmployeeQueryDto } from '../dto/employee-listing.dto';
import { DryRunDto } from '../dto/dry-run.dto';

import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

interface AuthPayload {
  enterpriseId: string;
  organizationId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly componentMasterService: ComponentMasterService,
    private readonly pfConfigService: PfConfigService,
    private readonly salaryTemplateEngine: SalaryTemplateEngine,
    private readonly employeeSalaryEngine: EmployeeSalaryEngine,
    private readonly dryRunEngine: DryRunEngine,
  ) {}

  // --- Payroll Settings ---
  @Put('configurations')
  async updateSettings(
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
  async getSettings(@CurrentUser() user: AuthPayload) {
    return this.payrollService.getSetting(
      user.enterpriseId,
      user.organizationId,
    );
  }

  // --- Component Master ---
  @Post('component-master')
  async createComponent(
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
  async getAllComponents(@CurrentUser() user: AuthPayload) {
    return this.componentMasterService.getAllComponents(
      user.enterpriseId,
      user.organizationId,
    );
  }

  @Put('component-master/:id')
  async updateComponent(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePayrollComponentDto>,
  ) {
    return this.componentMasterService.updateComponent(id, dto);
  }

  @Delete('component-master/:id')
  async deleteComponent(@Param('id') id: string) {
    return this.componentMasterService.deleteComponent(id);
  }

  // --- PF Configuration ---
  @Put('statutory-pf-config')
  async updatePfConfig(
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
  async getPfConfig(@CurrentUser() user: AuthPayload) {
    return this.pfConfigService.getConfig(
      user.enterpriseId,
      user.organizationId,
    );
  }

  // --- Salary Templates ---
  @Post('salary-templates')
  async createTemplate(
    @CurrentUser() user: AuthPayload,
    @Body() dto: CreateSalaryTemplateDto,
  ) {
    return this.salaryTemplateEngine.createTemplate(
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  @Get('salary-templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.salaryTemplateEngine.getTemplateById(id);
  }

  @Get('salary-templates')
  async getAllTemplates(@CurrentUser() user: AuthPayload) {
    return this.salaryTemplateEngine.getAllTemplates(
      user.enterpriseId,
      user.organizationId,
    );
  }

  // --- Dry Run ---
  @Post('simulations/dry-run')
  @HttpCode(200)
  async dryRun(@CurrentUser() user: AuthPayload, @Body() dto: DryRunDto) {
    return this.dryRunEngine.simulate(
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  // --- Employee Salary ---
  @Post('employee-salary-assignments')
  async assignSalaryToEmployee(
    @CurrentUser() user: AuthPayload,
    @Body() dto: AssignEmployeeSalaryDto,
  ) {
    return this.employeeSalaryEngine.assignSalary(
      user.enterpriseId,
      user.organizationId,
      dto,
    );
  }

  @Get('employees')
  async getEmployeesList(
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
  async getEmployeeSalaryStructure(@Param('userId') userId: string) {
    return this.employeeSalaryEngine.getEmployeeSalaryStructure(userId);
  }

  @Put('employees/:userId/salary')
  async updateEmployeeSalaryStructure(
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
}
