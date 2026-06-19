import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
