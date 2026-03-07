import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganizationProfileDto } from './create-organization-profile.dto';

export class UpdateOrganizationProfileDto extends PartialType(
  CreateOrganizationProfileDto,
) {}
