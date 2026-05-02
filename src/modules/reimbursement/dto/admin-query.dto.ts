import { IsOptional, IsUUID } from 'class-validator';
import { EmployeeReimbursementQueryDto } from './employee-query.dto';

export class AdminReimbursementQueryDto extends EmployeeReimbursementQueryDto {
  @IsOptional()
  @IsUUID()
  employee_id?: string;
}
