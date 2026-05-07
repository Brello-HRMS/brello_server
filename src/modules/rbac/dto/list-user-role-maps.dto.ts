import { IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/pagination.dto';

export class ListUserRoleMapsDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  role_id?: string;

  @IsOptional()
  @IsString()
  app_id?: string;

  @IsOptional()
  @IsString()
  user_id?: string;
}
