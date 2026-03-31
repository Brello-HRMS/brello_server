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
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
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

@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.employeeService.createEmployee(
      dto,
      user.enterpriseId,
      user.organizationId,
    );
  }

  @Get('dropdown')
  async getDropdown(@LoggedInUser() user: LoggedInUserInterface) {
    return this.employeeService.getDropdown(user);
  }

  @Get()
  async listEmployees(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: ListEmployeesDto,
  ) {
    return this.employeeService.listEmployees(user, query);
  }

  @Get(':id')
  async getEmployeeAggregate(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.getEmployeeAggregate(id);
  }

  @Patch(':id/personal')
  async updatePersonalDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeProfileDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.updatePersonalDetails(id, dto, actor.userId);
  }

  @Patch(':id/employment')
  async updateEmploymentDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeBasicDto & UpdateEmployeeProfileDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.updateEmploymentDetails(id, dto, actor.userId);
  }

  @Patch(':id/payroll')
  async updatePayrollInformation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePayrollInfoDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.updatePayrollInformation(id, dto, actor.userId);
  }

  @Post(':id/onboard')
  async onboardEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.onboardEmployee(id, actor.userId);
  }

  @Post(':id/documents')
  async uploadDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadDocumentsDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.uploadDocuments(id, dto, actor.userId);
  }

  @Post(':id/education')
  async addEducation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddEducationDto,
  ) {
    return this.employeeService.addEducation(id, dto);
  }

  @Patch(':id/education/:eduId')
  async updateEducation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eduId', ParseUUIDPipe) eduId: string,
    @Body() dto: AddEducationDto,
  ) {
    return this.employeeService.updateEducation(id, eduId, dto);
  }

  @Delete(':id/education/:eduId')
  async deleteEducation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eduId', ParseUUIDPipe) eduId: string,
  ) {
    return this.employeeService.deleteEducation(id, eduId);
  }

  @Post(':id/experience')
  async addExperience(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddExperienceDto,
  ) {
    return this.employeeService.addExperience(id, dto);
  }

  @Patch(':id/experience/:expId')
  async updateExperience(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('expId', ParseUUIDPipe) expId: string,
    @Body() dto: AddExperienceDto,
  ) {
    return this.employeeService.updateExperience(id, expId, dto);
  }

  @Delete(':id/experience/:expId')
  async deleteExperience(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('expId', ParseUUIDPipe) expId: string,
  ) {
    return this.employeeService.deleteExperience(id, expId);
  }

  @Get(':id/profile-completion')
  async getProfileCompletion(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.getProfileCompletion(id);
  }

  @Patch(':id/system-access')
  async updateSystemAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSystemAccessDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.updateSystemAccess(id, dto, actor.userId);
  }

  @Post(':id/offboarding/initiate')
  async initiateOffboarding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitiateOffboardingDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.initiateOffboarding(id, dto, actor.userId);
  }

  @Patch(':id/offboarding')
  async updateOffboarding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOffboardingDto,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.updateOffboarding(id, dto, actor.userId);
  }

  @Delete(':id/offboarding')
  async cancelOffboarding(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() actor: LoggedInUserInterface,
  ) {
    return this.employeeService.cancelOffboarding(id, actor.userId);
  }

  @Get(':id/offboarding')
  async getOffboardingDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.getOffboardingDetails(id);
  }

  @Delete(':id')
  async softDeleteEmployee(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.softDeleteEmployee(id);
  }
}
