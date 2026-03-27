import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HolidayCalendar } from './entities/holiday-calendar.entity';
import { Holiday } from './entities/holiday.entity';
import { HolidayCalendarRepository } from './repositories/holiday-calendar.repository';
import { HolidayRepository } from './repositories/holiday.repository';
import { HolidayCalendarService } from './services/holiday-calendar.service';
import { HolidayService } from './services/holiday.service';
import { HolidayCalendarController } from './controllers/holiday-calendar.controller';
import { HolidayController } from './controllers/holiday.controller';
import { EmployeeHolidayController } from './controllers/employee-holiday.controller';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HolidayCalendar, Holiday]),
    RbacModule,
  ],
  controllers: [
    HolidayCalendarController,
    HolidayController,
    EmployeeHolidayController,
  ],
  providers: [
    HolidayCalendarService,
    HolidayService,
    HolidayCalendarRepository,
    HolidayRepository,
  ],
  exports: [HolidayCalendarService, HolidayService],
})
export class HolidayModule {}
