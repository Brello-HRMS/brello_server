import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class EnterpriseResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  domain: string;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;
}
