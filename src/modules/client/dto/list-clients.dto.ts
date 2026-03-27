import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/pagination.dto';
import { Status } from '../../../common/enums';

export class ListClientsDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(Status)
  status?: Status;
}
