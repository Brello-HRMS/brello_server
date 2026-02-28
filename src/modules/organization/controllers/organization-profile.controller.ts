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
import { OrganizationProfileService } from '../services/organization-profile.service';
import { CreateOrganizationProfileDto } from '../dto/create-organization-profile.dto';
import { UpdateOrganizationProfileDto } from '../dto/update-organization-profile.dto';

@Controller('organization-profiles')
export class OrganizationProfileController {
  constructor(private readonly profileService: OrganizationProfileService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createDto: CreateOrganizationProfileDto) {
    return this.profileService.create(createDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.profileService.findOne(id);
  }

  @Get('organization/:organizationId')
  @HttpCode(HttpStatus.OK)
  findByOrganization(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.profileService.findByOrganizationId(organizationId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateOrganizationProfileDto,
  ) {
    return this.profileService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.profileService.remove(id);
  }
}
