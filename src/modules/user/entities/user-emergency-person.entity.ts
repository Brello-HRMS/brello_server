import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserProfile } from './user-profile.entity';
import { Document } from '../../document/entities/document.entity';
import { EmergencyRelation } from '../enums/user.enum';

@Entity('user_emergency_person')
export class UserEmergencyPerson extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'enum', enum: EmergencyRelation })
  relation: EmergencyRelation;

  @Column({ type: 'uuid', nullable: true })
  photo_id: string;

  @ManyToOne(() => Document, { nullable: true })
  @JoinColumn({ name: 'photo_id' })
  photo: Document;

  @Column({ type: 'uuid' })
  user_profile_id: string;

  @ManyToOne(() => UserProfile, (profile) => profile.emergency_contacts)
  @JoinColumn({ name: 'user_profile_id' })
  user_profile: UserProfile;
}
