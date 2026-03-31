import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserProfile } from './user-profile.entity';

@Entity('user_experience')
export class UserExperience extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  designation: string;

  @Column({ type: 'varchar', length: 255 })
  company: string;

  @Column({ type: 'date', nullable: true })
  from_date: Date;

  @Column({ type: 'date', nullable: true })
  to_date: Date;

  @Column({ type: 'boolean', default: false })
  is_current: boolean;

  @Column({ type: 'uuid' })
  user_profile_id: string;

  @ManyToOne(() => UserProfile, (profile) => profile.experiences)
  @JoinColumn({ name: 'user_profile_id' })
  user_profile: UserProfile;
}
