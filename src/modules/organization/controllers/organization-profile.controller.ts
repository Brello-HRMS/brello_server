import { AccessGuard } from '../../../core/guards/access.guard';
import { RequirePermission } from '../../../core/guards/require-permission.decorator';
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
import { OrganizationProfileService } from '../services/organization-profile.service';
import { CreateOrganizationProfileDto } from '../dto/create-organization-profile.dto';
import { UpdateOrganizationProfileDto } from '../dto/update-organization-profile.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('organization-profiles')
@UseGuards(JwtAuthGuard, AccessGuard)
export class OrganizationProfileController {
  constructor(private readonly profileService: OrganizationProfileService) {}

  @Post()
  @RequirePermission('ORG_PROFILE', 'create')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createDto: CreateOrganizationProfileDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.profileService.create(createDto, user);
  }

  @Get(':id')
  @RequirePermission('ORG_PROFILE', 'view')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.profileService.findOne(id, user);
  }

  @Get('organization/:organizationId')
  @RequirePermission('ORG_PROFILE', 'view')
  @HttpCode(HttpStatus.OK)
  findByOrganization(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.profileService.findByOrganizationId(organizationId, user);
  }

  @Patch(':id')
  @RequirePermission('ORG_PROFILE', 'update')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateOrganizationProfileDto,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.profileService.update(id, updateDto, user);
  }

  @Delete(':id')
  @RequirePermission('ORG_PROFILE', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @LoggedInUser() user: LoggedInUserInterface,
  ) {
    return this.profileService.remove(id, user);
  }
}
