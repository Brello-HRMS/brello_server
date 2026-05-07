import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { ReimbursementStatus } from '../enums/reimbursement.enum';

export class UpdateStatusDto {
  @IsEnum([ReimbursementStatus.APPROVED, ReimbursementStatus.REJECTED])
  status: ReimbursementStatus.APPROVED | ReimbursementStatus.REJECTED;

  @ValidateIf((o) => o.status === ReimbursementStatus.REJECTED)
  @IsString()
  rejection_reason?: string;
}
