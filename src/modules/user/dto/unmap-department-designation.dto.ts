import { IsUUID, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';

export class UnmapDepartmentDesignationDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsBoolean()
  unmapDepartment?: boolean;

  @IsOptional()
  @IsBoolean()
  unmapDesignation?: boolean;
}
