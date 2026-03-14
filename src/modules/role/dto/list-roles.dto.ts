import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/pagination.dto';

export class ListRolesDto extends ListQueryDto {
  @IsOptional()
  @IsBoolean()
  is_system_role?: boolean;

  @IsOptional()
  @IsString()
  sort_by?: string = 'created_at';

  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC' = 'DESC';
}
