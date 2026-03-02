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

  @IsString()
  @IsNotEmpty({ message: 'App description is required' })
  @Length(2, 100, {
    message: 'App description must be between 2 and 100 characters',
  })
  description: string;

  @IsString()
  @IsOptional()
  @Length(2, 100, {
    message: 'App icon must be between 2 and 100 characters',
  })
  icon?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  priority?: number;
}
