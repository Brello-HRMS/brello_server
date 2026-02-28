import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserProfile } from './user-profile.entity';
import { Document } from '../../document/entities/document.entity';

@Entity('user_document')
export class UserDocument extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'uuid' })
  doc_id: string;

  @ManyToOne(() => Document)
  @JoinColumn({ name: 'doc_id' })
  document: Document;

  @Column({ type: 'uuid' })
  user_profile_id: string;

  @ManyToOne(() => UserProfile, (profile) => profile.documents)
  @JoinColumn({ name: 'user_profile_id' })
  user_profile: UserProfile;
}
