import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    Length,
    Matches,
} from 'class-validator';

import { Status } from '../../../common/enums';

export class CreateDepartmentDto {

    @IsString()
    @IsNotEmpty({ message: 'Department code is required' })
    @Length(1, 50, { message: 'Code must be between 1 and 50 characters' })
    @Matches(/^[A-Z0-9_-]+$/, {
        message: 'Code must be uppercase alphanumeric (A-Z, 0-9, -, _)',
    })
    code: string;

    @IsString()
    @IsNotEmpty({ message: 'Department name is required' })
    @Length(2, 255, { message: 'Name must be between 2 and 255 characters' })
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    icon?: string;

    @IsEnum(Status, { message: 'Status must be ACTIVE or INACTIVE' })
    @IsOptional()
    status?: Status;
}
