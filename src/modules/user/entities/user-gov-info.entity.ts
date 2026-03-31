import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserProfile } from './user-profile.entity';

@Entity('user_gov_info')
export class UserGovInfo extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  uan: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  aadhaar: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  pan: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  esi: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  passport: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  driving_licence: string;

  @Column({ type: 'uuid' })
  user_profile_id: string;

  @OneToOne(() => UserProfile, (profile) => profile.gov_info)
  @JoinColumn({ name: 'user_profile_id' })
  user_profile: UserProfile;
}
