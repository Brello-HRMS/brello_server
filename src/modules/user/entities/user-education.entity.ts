import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserProfile } from './user-profile.entity';

@Entity('user_education')
export class UserEducation extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  school_name: string;

  @Column({ type: 'varchar', length: 150 })
  degree: string;

  @Column({ type: 'varchar', length: 150 })
  field_of_study: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completion_date: Date;

  @Column({ type: 'varchar', length: 4, nullable: true })
  completion_year: string;

  @Column({ type: 'text', nullable: true })
  additional_detail: string;

  @Column({ type: 'uuid' })
  user_profile_id: string;

  @ManyToOne(() => UserProfile, (profile) => profile.educations)
  @JoinColumn({ name: 'user_profile_id' })
  user_profile: UserProfile;
}
