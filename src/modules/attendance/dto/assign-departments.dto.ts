import { IsArray, ArrayMinSize, IsUUID } from 'class-validator';

export class AssignDepartmentsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 department_id is required' })
  @IsUUID('4', {
    each: true,
    message: 'Each department_id must be a valid UUID',
  })
  department_ids: string[];
}
