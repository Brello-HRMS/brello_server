import { PartialType } from '@nestjs/mapped-types';
import { CreateWeeklyOffDto } from './create-weekly-off.dto';

export class UpdateWeeklyOffDto extends PartialType(CreateWeeklyOffDto) {}
