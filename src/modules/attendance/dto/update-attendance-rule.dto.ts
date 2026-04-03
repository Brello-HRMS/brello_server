import { PartialType } from '@nestjs/mapped-types';
import { CreateAttendanceRuleDto } from './create-attendance-rule.dto';

export class UpdateAttendanceRuleDto extends PartialType(CreateAttendanceRuleDto) {}
