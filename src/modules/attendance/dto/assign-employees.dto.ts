import { IsArray, ArrayMinSize, IsUUID } from 'class-validator';

export class AssignEmployeesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 employee_id is required' })
  @IsUUID('4', { each: true, message: 'Each employee_id must be a valid UUID' })
  employee_ids: string[];
}
