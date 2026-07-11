import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, Min } from 'class-validator';

export class ApproveOfferStepDto {
  @IsString()
  @IsOptional()
  comment?: string;
}

export class RejectOfferStepDto {
  @IsString()
  @IsNotEmpty()
  comment: string;
}

export class AddApprovalStepDto {
  @IsString()
  @IsNotEmpty()
  role_name: string;

  @IsUUID()
  @IsNotEmpty()
  approver_id: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  step_order?: number;
}
