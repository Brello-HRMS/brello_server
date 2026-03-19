import { IsString, IsOptional, IsEnum, Length } from 'class-validator';
import { Status } from '../../../common/enums';

export class UpdateDepartmentDto {

    @IsString()
    @IsOptional()
    @Length(2, 255, { message: 'Name must be between 2 and 255 characters' })
    name?: string;

    @IsEnum(Status, { message: 'Status must be ACTIVE or INACTIVE' })
    @IsOptional()
    status?: Status;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    icon?: string;
}
