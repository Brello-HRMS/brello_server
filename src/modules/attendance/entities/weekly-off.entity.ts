import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { SaturdayRule } from '../enums/saturday-rule.enum';

@Entity('weekly_offs')
@Index(['organization_id', 'name'], {
  unique: true,
  where: '"is_deleted" = false',
})
@Index(['organization_id', 'is_deleted'])
export class WeeklyOff extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: DayOfWeek, array: true })
  days: DayOfWeek[];

  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  saturday_rule: SaturdayRule | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  saturday_off_weeks: number[] | null;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
