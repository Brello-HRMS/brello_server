import { IsString, IsNotEmpty, IsOptional, Length, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * `is_default` arrives as a real boolean on JSON requests but as the string
 * "true"/"false" when the field rides along a multipart/form-data upload
 * (FileInterceptor does not coerce sibling text fields). Accept both shapes.
 */
const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return value;
};

export class CreateSignatoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @Length(2, 120, { message: 'Name must be between 2 and 120 characters' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Designation is required' })
  @Length(2, 120, { message: 'Designation must be between 2 and 120 characters' })
  designation: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  is_default?: boolean;
}

export class UpdateSignatoryDto {
  @IsString()
  @IsOptional()
  @Length(2, 120, { message: 'Name must be between 2 and 120 characters' })
  name?: string;

  @IsString()
  @IsOptional()
  @Length(2, 120, { message: 'Designation must be between 2 and 120 characters' })
  designation?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  is_default?: boolean;
}
