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
  UseGuards,
} from '@nestjs/common';
import { OrganizationService } from '../services/organization.service';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { SetupCompanyDto } from '../dto/setup-company.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  async setupCompany(@Body() dto: SetupCompanyDto) {
    return this.organizationService.setupCompany(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.organizationService.findAll(user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.organizationService.findOne(id, user);
  }

  @Get('enterprise/:enterpriseId')
  @HttpCode(HttpStatus.OK)
  findByEnterprise(
    @Param('enterpriseId', ParseUUIDPipe) enterpriseId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.organizationService.findByEnterpriseId(enterpriseId, user);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(id, updateOrganizationDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.organizationService.remove(id, user);
  }
}
