import {
  IsString,
  IsNotEmpty,
  Length,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateEnterpriseDto {
  @IsString()
  @IsNotEmpty({ message: 'Enterprise name is required' })
  @Length(2, 255, {
    message: 'Enterprise name must be between 2 and 255 characters',
  })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Domain is required' })
  @Length(2, 255, {
    message: 'Domain must be between 2 and 255 characters',
  })
  @Matches(/^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,63}$/, {
    message: 'Domain must be a valid format (e.g. example.com, example.co.in)',
  })
  domain: string;

  @IsString()
  @IsOptional()
  @Length(2, 255, {
    message: 'Logo URL must be between 2 and 255 characters',
  })
  logo?: string;

  @IsString()
  @IsOptional()
  @Length(2, 255, {
    message: 'Favicon URL must be between 2 and 255 characters',
  })
  favicon?: string;
}
