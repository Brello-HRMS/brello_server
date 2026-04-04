import { IsUUID, IsOptional, IsNotEmpty } from 'class-validator';

export class MapDepartmentDesignationDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  designationId?: string;
}
