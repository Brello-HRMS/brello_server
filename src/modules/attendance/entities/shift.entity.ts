import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('shifts')
@Index(['organization_id', 'name'], { unique: true, where: '"is_deleted" = false' })
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

  @Column({ type: 'varchar', length: 5, nullable: true })
  auto_checkout_time: string;

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
