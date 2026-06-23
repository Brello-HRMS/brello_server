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
import { AuditLog } from '../../audit/decorators/audit-log.decorator';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AuditAction } from '../../audit/enums/audit-action.enum';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @AuditLog(AuditLogModule.ORGANIZATION, AuditAction.CREATE, 'organization')
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  async setupCompany(@Body() dto: SetupCompanyDto) {
    return this.organizationService.setupCompany(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  findAll(@LoggedInUser() user: LoggedInUserInterface) {
    return this.organizationService.findAll(user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.organizationService.findOne(id, user);
  }

  @Get('enterprise/:enterpriseId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  findByEnterprise(
    @Param('enterpriseId', ParseUUIDPipe) enterpriseId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.organizationService.findByEnterpriseId(enterpriseId, user);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.organizationService.getStats(id, user);
  }

  @AuditLog(AuditLogModule.ORGANIZATION, AuditAction.UPDATE, 'organization')
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(id, updateOrganizationDto, user);
  }

  @AuditLog(AuditLogModule.ORGANIZATION, AuditAction.DELETE, 'organization')
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.organizationService.remove(id, user);
  }
}
