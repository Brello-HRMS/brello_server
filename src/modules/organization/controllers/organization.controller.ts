import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrganizationService } from '../services/organization.service';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { SetupCompanyDto } from '../dto/setup-company.dto';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  async setupCompany(@Body() dto: SetupCompanyDto) {
    await this.organizationService.setupCompany(dto);

    return {
      success: true,
      message: 'Company setup completed successfully',
      setup_required: false,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.organizationService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.findOne(id);
  }

  @Get('enterprise/:enterpriseId')
  @HttpCode(HttpStatus.OK)
  findByEnterprise(@Param('enterpriseId', ParseUUIDPipe) enterpriseId: string) {
    return this.organizationService.findByEnterpriseId(enterpriseId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(id, updateOrganizationDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.remove(id);
  }
}
