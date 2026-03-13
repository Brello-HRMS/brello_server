import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserProfile } from './user-profile.entity';

@Entity('user_assets')
export class UserAssets extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'uuid' })
  user_profile_id: string;

  @ManyToOne(() => UserProfile, (profile) => profile.assets)
  @JoinColumn({ name: 'user_profile_id' })
  user_profile: UserProfile;
}
