import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { HolidayService } from '../services/holiday.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('employee/holidays')
@UseGuards(JwtAuthGuard)
export class EmployeeHolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getEmployeeHolidays(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query('year') year: number,
  ) {
    const currentYear = year || new Date().getFullYear();
    return this.holidayService.getEmployeeHolidays(user, currentYear);
  }
}
