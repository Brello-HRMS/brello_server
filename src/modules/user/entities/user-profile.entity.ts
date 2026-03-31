import {
  Entity,
  Column,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Document } from '../../document/entities/document.entity';
import { User } from './user.entity';
import { UserEducation } from './user-education.entity';
import { UserExperience } from './user-experience.entity';
import { UserAssets } from './user-assets.entity';
import { UserGovInfo } from './user-gov-info.entity';
import { UserBankInfo } from './user-bank-info.entity';
import { UserDocument } from './user-document.entity';
import { UserEmergencyPerson } from './user-emergency-person.entity';
import {
  UserType,
  MaritalStatus,
  Gender,
  EmploymentType,
  WorkLocation,
  BloodGroup,
  ExitType,
  EmployeeStatus,
  TaxRegime,
} from '../enums/user.enum';

@Entity('user_profile')
export class UserProfile extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  @Index({ unique: true })
  employee_id: string;

  @Column({ type: 'enum', enum: UserType, default: UserType.EMPLOYEE })
  type: UserType;

  // Required by schema, potentially mirrors the auth email but resides on profile
  @Column({ type: 'varchar', length: 255, unique: true })
  @Index({ unique: true })
  email: string;

  @Column({
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.DRAFT,
  })
  employee_status: EmployeeStatus;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  @Index({ unique: true })
  phone: string;

  @Column({ type: 'date', nullable: true })
  dob: Date;

  @Column({ type: 'enum', enum: MaritalStatus, nullable: true })
  marital_status: MaritalStatus;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nationality: string;

  @Column({ type: 'enum', enum: EmploymentType, nullable: true })
  employment_type: EmploymentType;

  @Column({ type: 'date', nullable: true })
  joining_date: Date;

  @Column({ type: 'date', nullable: true })
  employment_date: Date;

  @Column({ type: 'enum', enum: WorkLocation, nullable: true })
  work_location: WorkLocation;

  @Column({ type: 'varchar', length: 50, nullable: true })
  probation_period: string;

  @Column({ type: 'enum', enum: BloodGroup, nullable: true })
  blood_group: BloodGroup;

  @Column({ type: 'text', nullable: true })
  medical_info: string;

  @Column({ type: 'text', nullable: true })
  present_address: string;

  @Column({ type: 'text', nullable: true })
  permanent_address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  current_salary: string;

  @Column({ type: 'text', nullable: true })
  additional_detail: string;

  @Column({ type: 'int', default: 30 })
  notice_period: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  annual_ctc: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  monthly_gross: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  allowances: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bonus: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  total_ctc: string;

  @Column({ type: 'enum', enum: TaxRegime, nullable: true })
  tax_regime: TaxRegime;

  @Column({ type: 'enum', enum: ExitType, nullable: true })
  exit_type: ExitType;

  @Column({ type: 'date', nullable: true })
  last_working_day: Date;

  @Column({ type: 'text', nullable: true })
  exit_reason: string;

  // Relations

  // Link back to User (Auth record)
  @OneToOne(() => User, (user) => user.user_profile)
  user: User;

  @Column({ type: 'uuid', nullable: true })
  photo_id: string;

  @ManyToOne(() => Document, { nullable: true })
  @JoinColumn({ name: 'photo_id' })
  photo: Document;

  @Column({ type: 'uuid', nullable: true })
  added_by_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'added_by_id' })
  added_by: User;

  @Column({ type: 'uuid', nullable: true })
  modified_by_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'modified_by_id' })
  modifier: User;

  // 1:N Relations
  @OneToMany(() => UserEducation, (education) => education.user_profile)
  educations: UserEducation[];

  @OneToMany(() => UserExperience, (experience) => experience.user_profile)
  experiences: UserExperience[];

  @OneToMany(() => UserAssets, (asset) => asset.user_profile)
  assets: UserAssets[];

  @OneToMany(() => UserDocument, (doc) => doc.user_profile)
  documents: UserDocument[];

  @OneToMany(() => UserEmergencyPerson, (person) => person.user_profile)
  emergency_contacts: UserEmergencyPerson[];

  // 1:1 Relations
  @OneToOne(() => UserGovInfo, (govInfo) => govInfo.user_profile)
  gov_info: UserGovInfo;

  @OneToOne(() => UserBankInfo, (bankInfo) => bankInfo.user_profile)
  bank_info: UserBankInfo;
}
