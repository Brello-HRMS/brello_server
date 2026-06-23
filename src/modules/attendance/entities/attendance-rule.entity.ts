import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Shift } from './shift.entity';
import { WeeklyOff } from './weekly-off.entity';
import { GeoFence } from './geo-fence.entity';

@Entity('attendance_rules')
@Index(['organization_id', 'name'], {
  unique: true,
  where: '"is_deleted" = false',
})
@Index(['organization_id', 'is_deleted'])
@Index(['shift_id', 'status', 'is_deleted'])
@Index(['weekly_off_id', 'status', 'is_deleted'])
export class AttendanceRule extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'uuid' })
  shift_id: string;

  @ManyToOne(() => Shift, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;

  @Column({ type: 'uuid' })
  weekly_off_id: string;

  @ManyToOne(() => WeeklyOff, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'weekly_off_id' })
  weekly_off: WeeklyOff;

  @Column({ type: 'decimal', precision: 4, scale: 2 })
  full_day_hours: number;

  @Column({ type: 'decimal', precision: 4, scale: 2 })
  half_day_hours: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  overtime_after_hours: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 1 })
  overtime_multiplier: number;

  @Column({ type: 'boolean', default: false })
  allow_multiple_checkins: boolean;

  @Column({ type: 'boolean', default: false })
  require_geo_fencing: boolean;

  @Column({ type: 'boolean', default: true })
  allow_remote_in: boolean;

  @Column({ type: 'boolean', default: true })
  require_remote_reason: boolean;

  @Column({ type: 'boolean', default: false })
  remote_approval_required: boolean;

  @Column({ type: 'int', default: 0 })
  regularization_days_allowed: number;

  @OneToOne(() => GeoFence, (geoFence) => geoFence.rule, { cascade: true })
  geo_fence: GeoFence;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
