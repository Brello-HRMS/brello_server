import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export enum BulkInitScope {
  ORGANIZATION = 'ORGANIZATION',
  DEPARTMENT = 'DEPARTMENT',
  EMPLOYEES = 'EMPLOYEES',
}

export class BulkInitializeDto {
  @IsInt()
  @Min(2000)
  leave_year: number;

  @IsEnum(BulkInitScope)
  scope: BulkInitScope;

  @ValidateIf((o: BulkInitializeDto) => o.scope === BulkInitScope.DEPARTMENT)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  department_ids?: string[];

  @ValidateIf((o: BulkInitializeDto) => o.scope === BulkInitScope.EMPLOYEES)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  employee_ids?: string[];

  @IsOptional()
  @IsBoolean()
  auto_carry_forward?: boolean;
}
