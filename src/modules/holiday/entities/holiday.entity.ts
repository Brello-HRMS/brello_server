import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { HolidayType } from '../enums/holiday-type.enum';
import { HolidayCalendar } from './holiday-calendar.entity';

@Entity('holidays')
export class Holiday extends BaseEntity {
  @Column({ type: 'uuid' })
  calendar_id: string;

  @ManyToOne(() => HolidayCalendar, (calendar) => calendar.holidays, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'calendar_id' })
  calendar: HolidayCalendar;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'date' })
  date: string | Date;

  @Column({
    type: 'enum',
    enum: HolidayType,
    default: HolidayType.PUBLIC,
  })
  type: HolidayType;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string;

  @Column({ type: 'text', nullable: true })
  declare description: string;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;
}
