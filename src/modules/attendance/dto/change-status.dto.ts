import { IsEnum, IsNotEmpty } from 'class-validator';
import { Status } from '../../../common/enums';

export class ChangeStatusDto {
  @IsEnum(Status, { message: 'status must be ACTIVE or INACTIVE' })
  @IsNotEmpty({ message: 'status is required' })
  status: Status;
}
