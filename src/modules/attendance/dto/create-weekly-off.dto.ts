import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { SaturdayRule } from '../enums/saturday-rule.enum';

export class CreateWeeklyOffDto {
  @IsString()
  @IsNotEmpty({ message: 'Weekly off name is required' })
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMaxSize(7, { message: 'Maximum 7 days allowed' })
  @ArrayUnique({ message: 'Duplicate days are not allowed' })
  @IsString({ each: true })
  working_days: string[];

  @IsOptional()
  @IsEnum(SaturdayRule, { message: 'Invalid Saturday rule' })
  saturday_rule?: SaturdayRule;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  @ArrayMaxSize(5)
  saturday_off_weeks?: number[];
}
