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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationService } from '../services/organization.service';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { SetupCompanyDto } from '../dto/setup-company.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('logo'))
  async setupCompany(
    @Body() dto: SetupCompanyDto,
    @UploadedFile() logo?: any,
  ) {
    return this.organizationService.setupCompany(dto, logo);
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
