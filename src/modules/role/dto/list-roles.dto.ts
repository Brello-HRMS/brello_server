import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/pagination.dto';

export class ListRolesDto extends ListQueryDto {
  @IsOptional()
  @IsBoolean()
  is_system_role?: boolean;

  @IsOptional()
  @IsString()
  app_id?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  declare sort_by?: string;

  @IsOptional()
  @IsString()
  declare sort_order?: 'ASC' | 'DESC';
}
