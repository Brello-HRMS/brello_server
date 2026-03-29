import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    Length,
} from 'class-validator';
import { Status } from '../../../common/enums';

export class CreateCompanyPolicyTypeDto {
    @IsString()
    @IsNotEmpty({ message: 'Policy type name is required' })
    @Length(2, 255, { message: 'Name must be between 2 and 255 characters' })
    name: string;

    @IsString()
    @IsOptional()
    icon?: string;

    @IsEnum(Status, { message: 'Status must be ACTIVE or INACTIVE' })
    @IsOptional()
    status?: Status;
}

export class UpdateCompanyPolicyTypeDto {
    @IsString()
    @IsOptional()
    @Length(2, 255, { message: 'Name must be between 2 and 255 characters' })
    name?: string;

    @IsString()
    @IsOptional()
    icon?: string;

    @IsEnum(Status, { message: 'Status must be ACTIVE or INACTIVE' })
    @IsOptional()
    status?: Status;
}
