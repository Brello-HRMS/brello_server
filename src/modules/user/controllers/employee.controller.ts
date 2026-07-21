import { AccessGuard } from '../../../core/guards/access.guard';
import { RestrictedOnExpiry } from '../../billing/decorators/restricted-on-expiry.decorator';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Put,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmployeeService } from '../services/employee.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeBasicDto,
  UpdateEmployeeProfileDto,
  AddEducationDto,
  AddExperienceDto,
  AddAssetDto,
  UpdateGovInfoDto,
  UpdateBankInfoDto,
  AddDocumentDto,
  UpdateEmergencyContactDto,
  EmployeeExitDto,
  ListEmployeesDto,
  InitiateOffboardingDto,
  UpdateOffboardingDto,
  UploadDocumentsDto,
  UpdatePayrollInfoDto,
  UpdateSystemAccessDto,
} from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('employees')
@RestrictedOnExpiry()
@UseGuards(JwtAuthGuard, AccessGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @RequirePermission('ACCESS_USERS', 'create')
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.employeeService.createEmployee(
      dto,
      user.enterpriseId,
      user.organizationId,
      user.userId,
    );
  }

  @Get('dropdown')
  @RequirePermission('ACCESS_USERS', 'view')
  async getDropdown(@LoggedInUser() user: LoggedInUserInterface) {
    return this.employeeService.getDropdown(user);
  }

  @Get('me/dashboard-stats')
  getEmployeeDashboardStats(@LoggedInUser() user: LoggedInUserInterface) {
    return this.employeeService.getEmployeeDashboardStats(
      user.enterpriseId,
      user.organizationId,
      user.userId,
    );
  }

  @Get('stats')
  getDashboardStats(@LoggedInUser() user: LoggedInUserInterface) {
    return this.employeeService.getDashboardStats(user.organizationId);
  }

  @Get('new-hires')
  getNewHires(@LoggedInUser() user: LoggedInUserInterface) {
    return this.employeeService.getNewHires(user.organizationId);
  }

  @Get('birthdays')
  getBirthdays(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query('month') month?: string,
  ) {
    return this.employeeService.getBirthdays(
      user.organizationId,
      month ? Number(month) : undefined,
    );
  }

  @Get()
  @RequirePermission('ACCESS_USERS', 'view')
  async listEmployees(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListEmployeesDto,
  ) {
    return this.employeeService.listEmployees(user, query);
  }

  @Get(':id')
  @RequirePermission('ACCESS_USERS', 'view')
  async getEmployeeAggregate(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.getEmployeeAggregate(id);
  }

  @AuditLog(AuditLogModule.EMPLOYEE, AuditAction.UPDATE, 'employee')
  @Patch(':id/personal')
  @RequirePermission('ACCESS_USERS', 'update')
  async updatePersonalDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeProfileDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.updatePersonalDetails(id, dto, actor.userId);
  }

  @Post(':id/photo')
  @RequirePermission('ACCESS_USERS', 'create')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.setEmployeePhoto(actor, id, file);
  }

  @Patch(':id/employment')
  @RequirePermission('ACCESS_USERS', 'update')
  async updateEmploymentDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeBasicDto & UpdateEmployeeProfileDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.updateEmploymentDetails(id, dto, actor.userId);
  }

  @Patch(':id/payroll')
  @RequirePermission('ACCESS_USERS', 'update')
  async updatePayrollInformation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePayrollInfoDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.updatePayrollInformation(id, dto, actor.userId);
  }

  @Post(':id/onboard')
  @RequirePermission('ACCESS_USERS', 'create')
  async onboardEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.onboardEmployee(id, actor.userId);
  }

  @Post(':id/activate')
  @RequirePermission('ACCESS_USERS', 'create')
  @HttpCode(200)
  async activateEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.activateEmployee(id, actor.userId);
  }

  @Post(':id/documents')
  @RequirePermission('ACCESS_USERS', 'create')
  async uploadDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadDocumentsDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.uploadDocuments(id, dto, actor.userId);
  }

  @AuditLog(AuditLogModule.EMPLOYEE, AuditAction.CREATE, 'employee_education')
  @Post(':id/education')
  @RequirePermission('ACCESS_USERS', 'create')
  async addEducation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddEducationDto,
  ) {
    return this.employeeService.addEducation(id, dto);
  }

  @AuditLog(AuditLogModule.EMPLOYEE, AuditAction.UPDATE, 'employee_education', { entityIdParam: 'eduId' })
  @Patch(':id/education/:eduId')
  @RequirePermission('ACCESS_USERS', 'update')
  async updateEducation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eduId', ParseUUIDPipe) eduId: string,
    @Body() dto: AddEducationDto,
  ) {
    return this.employeeService.updateEducation(id, eduId, dto);
  }

  @AuditLog(AuditLogModule.EMPLOYEE, AuditAction.DELETE, 'employee_education', { entityIdParam: 'eduId' })
  @Delete(':id/education/:eduId')
  @RequirePermission('ACCESS_USERS', 'delete')
  async deleteEducation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eduId', ParseUUIDPipe) eduId: string,
  ) {
    return this.employeeService.deleteEducation(id, eduId);
  }

  @AuditLog(AuditLogModule.EMPLOYEE, AuditAction.CREATE, 'employee_experience')
  @Post(':id/experience')
  @RequirePermission('ACCESS_USERS', 'create')
  async addExperience(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddExperienceDto,
  ) {
    return this.employeeService.addExperience(id, dto);
  }

  @AuditLog(AuditLogModule.EMPLOYEE, AuditAction.UPDATE, 'employee_experience', { entityIdParam: 'expId' })
  @Patch(':id/experience/:expId')
  @RequirePermission('ACCESS_USERS', 'update')
  async updateExperience(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('expId', ParseUUIDPipe) expId: string,
    @Body() dto: AddExperienceDto,
  ) {
    return this.employeeService.updateExperience(id, expId, dto);
  }

  @AuditLog(AuditLogModule.EMPLOYEE, AuditAction.DELETE, 'employee_experience', { entityIdParam: 'expId' })
  @Delete(':id/experience/:expId')
  @RequirePermission('ACCESS_USERS', 'delete')
  async deleteExperience(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('expId', ParseUUIDPipe) expId: string,
  ) {
    return this.employeeService.deleteExperience(id, expId);
  }

  @Get(':id/profile-completion')
  @RequirePermission('ACCESS_USERS', 'view')
  async getProfileCompletion(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.getProfileCompletion(id);
  }

  @Patch(':id/system-access')
  @RequirePermission('ACCESS_USERS', 'update')
  async updateSystemAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSystemAccessDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.updateSystemAccess(id, dto, actor.userId);
  }

  @Post(':id/offboarding/initiate')
  @RequirePermission('ACCESS_USERS', 'create')
  async initiateOffboarding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitiateOffboardingDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.initiateOffboarding(id, dto, actor.userId);
  }

  @Patch(':id/offboarding')
  @RequirePermission('ACCESS_USERS', 'update')
  async updateOffboarding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOffboardingDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.updateOffboarding(id, dto, actor.userId);
  }

  @Delete(':id/offboarding')
  @RequirePermission('ACCESS_USERS', 'delete')
  async cancelOffboarding(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.cancelOffboarding(id, actor.userId);
  }

  @Get(':id/offboarding')
  @RequirePermission('ACCESS_USERS', 'view')
  async getOffboardingDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.getOffboardingDetails(id);
  }

  @Delete(':id')
  @RequirePermission('ACCESS_USERS', 'delete')
  async softDeleteEmployee(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.softDeleteEmployee(id);
  }
}
