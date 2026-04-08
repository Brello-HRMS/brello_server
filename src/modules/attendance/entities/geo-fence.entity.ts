import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AttendanceRule } from './attendance-rule.entity';

@Entity('geo_fences')
export class GeoFence extends BaseEntity {
  @Column({ type: 'uuid' })
  rule_id: string;

  @OneToOne(() => AttendanceRule, (rule) => rule.geo_fence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: AttendanceRule;

  @Column({ type: 'varchar', length: 255 })
  office_name: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'int' })
  radius_meters: number;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
