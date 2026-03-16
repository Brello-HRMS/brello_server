import { IsOptional, IsEnum, IsString, IsIn } from 'class-validator';
import { Status } from '../../../common/enums';
import { ListQueryDto } from '../../../common/dto/pagination.dto';

export class ListDepartmentsDto extends ListQueryDto {

    @IsEnum(Status, { message: 'Status must be a valid Status value' })
    @IsOptional()
    status?: Status;

    @IsString()
    @IsIn(['name', 'created_at'], { message: 'sort_by must be name or created_at' })
    @IsOptional()
    declare sort_by?: 'name' | 'created_at';

    @IsString()
    @IsIn(['ASC', 'DESC'], { message: 'sort_order must be ASC or DESC' })
    @IsOptional()
    declare sort_order?: 'ASC' | 'DESC';
}
