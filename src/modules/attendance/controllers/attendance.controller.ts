import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AttendanceService } from '../services/attendance.service';
import { CheckInDto } from '../dto/check-in.dto';
import { CheckOutDto } from '../dto/check-out.dto';
import { MeHistoryQueryDto } from '../dto/me-history-query.dto';
import { RegularizeAttendanceDto } from '../dto/regularize-attendance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoggedInUser } from '../../../common/decorators/logged-in-user.decorator';
import type { LoggedInUser as LoggedInUserInterface } from '../../auth/interfaces/logged-in-user.interface';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  checkIn(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CheckInDto,
    @Req() req: Request,
  ) {
    return this.attendanceService.checkIn(user, dto, req.ip);
  }

  @Get('check-in/pre-check')
  preCheck(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
  ) {
    const lat = latitude ? parseFloat(latitude) : undefined;
    const lng = longitude ? parseFloat(longitude) : undefined;
    return this.attendanceService.preCheckCheckIn(user, lat, lng);
  }

  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  checkOut(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: CheckOutDto,
    @Req() req: Request,
  ) {
    return this.attendanceService.checkOut(user, dto, req.ip);
  }

  @Get('me/today')
  getToday(@LoggedInUser() user: LoggedInUserInterface) {
    return this.attendanceService.getToday(user);
  }

  @Get('me/peers/today')
  getPeersToday(@LoggedInUser() user: LoggedInUserInterface) {
    return this.attendanceService.getPeersToday(user);
  }

  @Get('me/history')
  getMyHistory(
    @LoggedInUser() user: LoggedInUserInterface,
    @Query() query: MeHistoryQueryDto,
  ) {
    return this.attendanceService.getMyHistory(user, query);
  }

  @Get('rules')
  getRules(@LoggedInUser() user: LoggedInUserInterface) {
    return this.attendanceService.getEffectiveRules(user);
  }

  @Post('regularize')
  @HttpCode(HttpStatus.OK)
  regularize(
    @LoggedInUser() user: LoggedInUserInterface,
    @Body() dto: RegularizeAttendanceDto,
    @Req() req: Request,
  ) {
    return this.attendanceService.regularize(user, dto, req.ip);
  }
}
