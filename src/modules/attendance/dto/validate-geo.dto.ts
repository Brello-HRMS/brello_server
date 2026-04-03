import { IsUUID, IsNotEmpty, IsNumber } from 'class-validator';

export class ValidateGeoDto {
  @IsUUID('4', { message: 'employee_id must be a valid UUID' })
  @IsNotEmpty({ message: 'employee_id is required' })
  employee_id: string;

  @IsNumber()
  @IsNotEmpty({ message: 'latitude is required' })
  latitude: number;

  @IsNumber()
  @IsNotEmpty({ message: 'longitude is required' })
  longitude: number;
}
