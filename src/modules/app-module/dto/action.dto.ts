import { IsString, IsNotEmpty, Length, IsOptional } from 'class-validator';

export class CreateActionDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  name: string;
}

export class UpdateActionDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  name: string;
}
