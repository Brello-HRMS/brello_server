import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Status } from '../../../common/enums';

export class CreateClientDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  poc_name: string;

  @IsNotEmpty()
  @IsEmail()
  poc_email: string;

  @IsNotEmpty()
  @IsString()
  poc_phone: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsEnum(Status)
  status: Status;

  @IsOptional()
  @IsString()
  logo?: string;
}
