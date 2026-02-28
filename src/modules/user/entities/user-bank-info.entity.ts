import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserProfile } from './user-profile.entity';

@Entity('user_bank_info')
export class UserBankInfo extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  account_number: string;

  @Column({ type: 'varchar', length: 50 })
  ifsc_code: string;

  @Column({ type: 'varchar', length: 255 })
  bank_name: string;

  @Column({ type: 'uuid' })
  user_profile_id: string;

  @OneToOne(() => UserProfile, (profile) => profile.bank_info)
  @JoinColumn({ name: 'user_profile_id' })
  user_profile: UserProfile;
}
