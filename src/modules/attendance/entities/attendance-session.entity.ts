import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AttendanceMode } from '../enums/attendance-mode.enum';
import { AttendanceSource } from '../enums/attendance-source.enum';
import { GeoStatus } from '../enums/geo-status.enum';
import { AttendanceRecord } from './attendance-record.entity';

@Entity('attendance_sessions')
@Index(['organization_id', 'employee_id', 'check_in_at'])
@Index(['attendance_record_id'])
export class AttendanceSession extends BaseEntity {
  @Column({ type: 'uuid' })
  attendance_record_id: string;

  @ManyToOne(() => AttendanceRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attendance_record_id' })
  attendance_record: AttendanceRecord;

  @Column({ type: 'uuid' })
  employee_id: string;

  @Column({ type: 'timestamptz' })
  check_in_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  check_out_at: Date | null;

  @Column({ type: 'int', default: 0 })
  worked_minutes: number;

  @Column({ type: 'enum', enum: AttendanceMode })
  attendance_mode: AttendanceMode;

  @Column({
    type: 'enum',
    enum: AttendanceSource,
    default: AttendanceSource.WEB,
  })
  source: AttendanceSource;

  @Column({ type: 'enum', enum: GeoStatus, default: GeoStatus.NOT_APPLICABLE })
  geo_status: GeoStatus;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  check_in_latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  check_in_longitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  check_out_latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  check_out_longitude: number | null;

  @Column({ type: 'int', nullable: true })
  distance_from_office_meters: number | null;

  @Column({ type: 'text', nullable: true })
  remote_reason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  check_in_ip: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  check_out_ip: string | null;
}
