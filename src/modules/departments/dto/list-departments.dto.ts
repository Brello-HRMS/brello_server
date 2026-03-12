import { IsOptional, IsEnum, IsString, IsIn } from 'class-validator';
import { Status } from '../../../common/enums';

export class ListDepartmentsDto {

    @IsEnum(Status, { message: 'Status must be a valid Status value' })
    @IsOptional()
    status?: Status;

    @IsString()
    @IsOptional()
    search?: string;

    @IsString()
    @IsIn(['name', 'created_at'], { message: 'sort_by must be name or created_at' })
    @IsOptional()
    sort_by?: 'name' | 'created_at';

    @IsString()
    @IsIn(['ASC', 'DESC'], { message: 'sort_order must be ASC or DESC' })
    @IsOptional()
    sort_order?: 'ASC' | 'DESC';
}
