import {
  IsString,
  IsNotEmpty,
  Length,
  IsInt,
  IsOptional,
  Min,
  IsUUID,
} from 'class-validator';

export class CreateAppDto {
  @IsString()
  @IsNotEmpty({ message: 'App name is required' })
  @Length(2, 100, { message: 'App name must be between 2 and 100 characters' })
  name: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  priority?: number;

  @IsUUID('4', { message: 'Enterprise ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Enterprise ID is required' })
  enterprise_id: string;

  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Organization ID is required' })
  organization_id: string;
}
