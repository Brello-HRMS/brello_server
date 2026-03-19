import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsUUID,
    Length,
} from 'class-validator';
import { Status } from '../../../common/enums';

export class CreateCompanyPolicyDto {
    @IsString()
    @IsNotEmpty({ message: 'Policy title is required' })
    @Length(2, 255, { message: 'Title must be between 2 and 255 characters' })
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    placeholder?: string;

    @IsUUID('4', { message: 'Invalid policy type ID' })
    @IsNotEmpty({ message: 'Type ID is required' })
    type_id: string;

    @IsString()
    @IsNotEmpty({ message: 'Policy content is required' })
    content: string;

    @IsEnum(Status, { message: 'Status must be ACTIVE or INACTIVE' })
    @IsOptional()
    status?: Status;
}

export class UpdateCompanyPolicyDto {
    @IsString()
    @IsOptional()
    @Length(2, 255, { message: 'Title must be between 2 and 255 characters' })
    title?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    placeholder?: string;

    @IsUUID('4', { message: 'Invalid policy type ID' })
    @IsOptional()
    type_id?: string;

    @IsString()
    @IsOptional()
    content?: string;

    @IsEnum(Status, { message: 'Status must be ACTIVE or INACTIVE' })
    @IsOptional()
    status?: Status;
}
