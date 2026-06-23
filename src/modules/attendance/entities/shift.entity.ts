import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('shifts')
@Index(['organization_id', 'name'], {
  unique: true,
  where: '"is_deleted" = false',
})
@Index(['organization_id', 'is_deleted'])
export class Shift extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 5 })
  start_time: string;

  @Column({ type: 'varchar', length: 5 })
  end_time: string;

  @Column({ type: 'int', default: 0 })
  late_grace_minutes: number;

  /**
   * @deprecated Never enforced. Replaced by the computed auto-checkout formula
   * (overtime_grace_minutes + max_session_hours). Kept for backward read compat.
   */
  @Column({ type: 'varchar', length: 5, nullable: true })
  auto_checkout_time: string;

  // ─── Auto-checkout engine (auto-checkout.md) ────────────────────────────────

  /** Minutes after shift end during which OT is still captured before auto-checkout fires. */
  @Column({ type: 'int', default: 120 })
  overtime_grace_minutes: number;

  /** Absolute hard cap on a single session's duration, regardless of shift/OT. */
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 14 })
  max_session_hours: number;

  /** Per-shift toggle to disable auto-checkout (e.g. flexible-hours roles). */
  @Column({ type: 'boolean', default: true })
  auto_checkout_enabled: boolean;

  /** Extra delay before auto-checkout to absorb biometric device sync delays. */
  @Column({ type: 'int', default: 0 })
  sync_buffer_minutes: number;

  @Column({ type: 'boolean', default: false })
  allow_multiple_checkins: boolean;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  full_day_hours: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  half_day_hours: number;

  @Column({ type: 'boolean', default: false })
  is_night_shift: boolean;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
