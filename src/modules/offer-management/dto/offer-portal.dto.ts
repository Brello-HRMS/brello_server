import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsArray } from 'class-validator';

/** Candidate accepts the offer via the external portal. */
export class CandidateAcceptDto {
  @IsString()
  @IsNotEmpty()
  access_token: string;
}

/** Candidate rejects the offer via the external portal. */
export class CandidateRejectDto {
  @IsString()
  @IsNotEmpty()
  access_token: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  comment?: string;
}

/** Candidate requests changes (negotiation) via the external portal. */
export class CandidateRequestChangesDto {
  @IsString()
  @IsNotEmpty()
  access_token: string;

  @IsNumber()
  @IsOptional()
  expected_salary?: number;

  @IsDateString()
  @IsOptional()
  preferred_joining_date?: string;

  @IsString()
  @IsNotEmpty()
  comments: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];
}

/** Candidate sends a message in the negotiation workspace. */
export class CandidateSendMessageDto {
  @IsString()
  @IsNotEmpty()
  access_token: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];

  @IsString()
  @IsNotEmpty()
  sender_name: string;
}

/** Candidate uploads a preboarding document. */
export class CandidateUploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  access_token: string;

  @IsString()
  @IsNotEmpty()
  document_type: string;

  @IsString()
  @IsNotEmpty()
  file_url: string;

  @IsString()
  @IsOptional()
  original_filename?: string;
}
