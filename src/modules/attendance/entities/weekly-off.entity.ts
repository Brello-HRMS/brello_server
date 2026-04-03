import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { DayOfWeek } from '../enums/day-of-week.enum';

@Entity('weekly_offs')
@Index(['organization_id', 'name'], { unique: true, where: '"is_deleted" = false' })
export class WeeklyOff extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: DayOfWeek, array: true })
  days: DayOfWeek[];

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
