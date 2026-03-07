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
} from '../dto';

@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  async createEmployee(@Body() dto: CreateEmployeeDto) {
    const data = await this.employeeService.createEmployee(dto);
    return { success: true, data };
  }

  @Get()
  async listEmployees(@Query() query: any) {
    const response = await this.employeeService.listEmployees(query);
    return { success: true, ...response };
  }

  @Get(':id')
  async getEmployeeAggregate(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.getEmployeeAggregate(id);
  }

  @Patch(':id')
  async updateBasicInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeBasicDto,
  ) {
    return this.employeeService.updateBasicInfo(id, dto);
  }

  @Patch(':id/profile')
  async updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeProfileDto,
  ) {
    return this.employeeService.updateProfile(id, dto);
  }

  @Post(':id/education')
  async addEducation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddEducationDto,
  ) {
    return this.employeeService.addEducation(id, dto);
  }

  @Delete(':id/education/:educationId')
  async deleteEducation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('educationId', ParseUUIDPipe) educationId: string,
  ) {
    return this.employeeService.deleteEducation(id, educationId);
  }

  @Post(':id/experience')
  async addExperience(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddExperienceDto,
  ) {
    return this.employeeService.addExperience(id, dto);
  }

  @Delete(':id/experience/:experienceId')
  async deleteExperience(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('experienceId', ParseUUIDPipe) experienceId: string,
  ) {
    return this.employeeService.deleteExperience(id, experienceId);
  }

  @Post(':id/assets')
  async addAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddAssetDto,
  ) {
    return this.employeeService.addAsset(id, dto);
  }

  @Delete(':id/assets/:assetId')
  async deleteAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ) {
    return this.employeeService.deleteAsset(id, assetId);
  }

  @Put(':id/gov-info')
  async updateGovInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGovInfoDto,
  ) {
    return this.employeeService.updateGovInfo(id, dto);
  }

  @Put(':id/bank-info')
  async updateBankInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankInfoDto,
  ) {
    return this.employeeService.updateBankInfo(id, dto);
  }

  @Post(':id/documents')
  async attachDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDocumentDto,
  ) {
    return this.employeeService.attachDocument(id, dto);
  }

  @Delete(':id/documents/:docId')
  async removeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.employeeService.removeDocument(id, docId);
  }

  @Put(':id/emergency-contact')
  async updateEmergencyContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmergencyContactDto,
  ) {
    return this.employeeService.updateEmergencyContact(id, dto);
  }

  @Post(':id/exit')
  @HttpCode(200)
  async submitExit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EmployeeExitDto,
  ) {
    return this.employeeService.submitExit(id, dto);
  }

  @Delete(':id')
  async softDeleteEmployee(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeService.softDeleteEmployee(id);
  }
}
