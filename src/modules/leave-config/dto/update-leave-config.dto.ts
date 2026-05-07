import {
  IsInt,
  Min,
  Max,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeaveTypeDto } from './leave-type.dto';
import { LeaveRulesDto } from './leave-rules.dto';

export class UpdateLeaveConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalLeave?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeaveTypeDto)
  leaveTypes?: LeaveTypeDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LeaveRulesDto)
  rules?: LeaveRulesDto;
}
