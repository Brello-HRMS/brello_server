import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsArray,
  IsOptional,
  Length,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  feature?: string[];
}

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  feature?: string[];
}
