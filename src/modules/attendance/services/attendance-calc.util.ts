import { AttendanceRule } from '../entities/attendance-rule.entity';
import { Shift } from '../entities/shift.entity';
import { AttendanceStatus } from '../enums/attendance-status.enum';

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function todayLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatHmm(totalMinutes: number): string {
  const h = Math.floor(Math.max(0, totalMinutes) / 60);
  const m = Math.max(0, totalMinutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime12(date: Date | null | undefined): string | null {
  if (!date) return null;
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function diffMinutes(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function daysBetween(fromDate: string, toDate: Date = new Date()): number {
  const [y, m, d] = fromDate.split('-').map(Number);
  const from = new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
  const to = new Date(
    toDate.getFullYear(),
    toDate.getMonth(),
    toDate.getDate(),
  ).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

export function isCheckInLate(
  checkInAt: Date,
  shift: Shift,
): { isLate: boolean; lateMinutes: number } {
  const shiftStart = timeToMinutes(shift.start_time);
  const grace = shift.late_grace_minutes ?? 0;
  const checkInMinutes = checkInAt.getHours() * 60 + checkInAt.getMinutes();
  const lateBy = checkInMinutes - (shiftStart + grace);
  return {
    isLate: lateBy > 0,
    lateMinutes: Math.max(0, lateBy),
  };
}

export interface ComputedAttendance {
  worked_minutes: number;
  overtime_minutes: number;
  is_half_day: boolean;
  is_overtime: boolean;
  attendance_status: AttendanceStatus;
}

/**
 * Determine final attendance status from worked minutes and rule thresholds.
 * "Late" wins over "Present" when applicable; "Half-Day" wins when below threshold.
 */
export function computeAttendanceStatus(
  workedMinutes: number,
  rule: Pick<
    AttendanceRule,
    'full_day_hours' | 'half_day_hours' | 'overtime_after_hours'
  >,
  isLate: boolean,
): ComputedAttendance {
  const fullDayMinutes = Number(rule.full_day_hours) * 60;
  const halfDayMinutes = Number(rule.half_day_hours) * 60;
  const overtimeAfter = rule.overtime_after_hours
    ? Number(rule.overtime_after_hours) * 60
    : null;

  let status: AttendanceStatus;
  let isHalfDay = false;
  if (workedMinutes <= 0) {
    status = AttendanceStatus.ABSENT;
  } else if (workedMinutes < halfDayMinutes) {
    status = AttendanceStatus.ABSENT;
  } else if (workedMinutes < fullDayMinutes) {
    status = AttendanceStatus.HALF_DAY;
    isHalfDay = true;
  } else if (isLate) {
    status = AttendanceStatus.LATE;
  } else {
    status = AttendanceStatus.PRESENT;
  }

  const overtimeMinutes =
    overtimeAfter !== null && workedMinutes > overtimeAfter
      ? workedMinutes - overtimeAfter
      : 0;

  return {
    worked_minutes: workedMinutes,
    overtime_minutes: overtimeMinutes,
    is_half_day: isHalfDay,
    is_overtime: overtimeMinutes > 0,
    attendance_status: status,
  };
}
