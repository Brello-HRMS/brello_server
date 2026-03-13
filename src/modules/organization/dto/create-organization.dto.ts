import { IsString, IsNotEmpty, Length, IsUUID } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty({ message: 'Organization name is required' })
  @Length(2, 255, {
    message: 'Organization name must be between 2 and 255 characters',
  })
  name: string;

  @IsUUID('4', { message: 'Enterprise ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Enterprise ID is required' })
  enterprise_id: string;
}
