import {
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Status } from '../enums';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  enterprise_id: string;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string;

  @Column({
    type: 'enum',
    enum: Status,
    default: Status.ACTIVE,
  })
  status: Status;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @Column({ type: 'uuid', nullable: true })
  modified_by: string;

  @Column({ type: 'timestamp', nullable: true })
  modified_at: Date;

  @Column({ type: 'uuid', nullable: true })
  deleted_by: string;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date;
}
