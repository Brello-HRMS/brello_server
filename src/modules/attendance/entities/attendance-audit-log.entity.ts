import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AuditEventType } from '../enums/audit-event-type.enum';

@Entity('attendance_audit_logs')
@Index(['organization_id', 'employee_id', 'created_at'])
@Index(['organization_id', 'event_type', 'created_at'])
@Index(['attendance_record_id'])
export class AttendanceAuditLog extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  attendance_record_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  attendance_session_id: string | null;

  @Column({ type: 'uuid' })
  employee_id: string;

  @Column({ type: 'uuid' })
  performed_by: string;

  @Column({ type: 'enum', enum: AuditEventType })
  event_type: AuditEventType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  device: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @Column({ type: 'jsonb', nullable: true })
  old_value: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  new_value: Record<string, unknown> | null;
}
