import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Status } from '../../../common/enums';
import { Holiday } from './holiday.entity';

@Entity('holiday_calendars')
export class HolidayCalendar extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'boolean', default: false })
  is_deleted: boolean;

  @OneToMany(() => Holiday, (holiday) => holiday.calendar, { cascade: true })
  holidays: Holiday[];
}
