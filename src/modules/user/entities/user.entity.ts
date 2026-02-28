import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserProfile } from './user-profile.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  first_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  middle_name: string;

  @Column({ type: 'varchar', length: 100 })
  last_name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index({ unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  @Index({ unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @Column({ type: 'uuid', nullable: true })
  reports_to_id: string;

  @ManyToOne(() => User, (user) => user.subordinates, { nullable: true })
  @JoinColumn({ name: 'reports_to_id' })
  reports_to: User;

  // Virtual property for inverse side
  subordinates: User[];

  @Column({ type: 'uuid', nullable: true })
  department_id: string;

  // @ManyToOne(() => Department)
  // @JoinColumn({ name: 'department_id' })
  // department: Department;

  @Column({ type: 'uuid', nullable: true })
  designation_id: string;

  // @ManyToOne(() => Designation)
  // @JoinColumn({ name: 'designation_id' })
  // designation: Designation;

  @Column({ type: 'uuid', nullable: true })
  user_profile_id: string;

  @OneToOne(() => UserProfile, (profile) => profile.user, { nullable: true })
  @JoinColumn({ name: 'user_profile_id' })
  user_profile: UserProfile;

  /**
   * Last app the user accessed.
   * Used to auto-redirect user to their preferred app on next login.
   * If null → login will choose the highest-priority app.
   */
  @Column({ type: 'uuid', nullable: true })
  last_access_app_id: string;

  get fullName(): string {
    return [this.first_name, this.middle_name, this.last_name]
      .filter(Boolean)
      .join(' ');
  }
}
