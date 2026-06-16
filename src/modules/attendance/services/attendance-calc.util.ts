import { AttendanceRule } from '../entities/attendance-rule.entity';
import { Shift } from '../entities/shift.entity';
import { WeeklyOff } from '../entities/weekly-off.entity';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { DayOfWeek } from '../enums/day-of-week.enum';
import { SaturdayRule } from '../enums/saturday-rule.enum';

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

// ─── Auto-checkout engine (auto-checkout.md) ──────────────────────────────────

/** Coerce a possibly-string/null DECIMAL column to a finite, non-negative number. */
function safeNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Resolves the absolute datetime a shift ends for a given check-in. For night
 * shifts whose end_time is on the next calendar day, rolls the date forward.
 */
export function resolveShiftEndDatetime(
  checkInAt: Date,
  shift: Pick<Shift, 'end_time' | 'is_night_shift'>,
): Date {
  const [endHour, endMin] = shift.end_time.split(':').map(Number);
  const endDate = new Date(checkInAt);
  endDate.setHours(endHour, endMin, 0, 0);

  if (shift.is_night_shift && endDate <= checkInAt) {
    endDate.setDate(endDate.getDate() + 1);
  }
  return endDate;
}

/**
 * The timestamp at which an open session should be auto-closed:
 * min(shift end + overtime grace + sync buffer, check-in + max session hours).
 * Returns the cap that fires first so OT is preserved but sessions never run away.
 */
export function resolveAutoCheckoutAt(
  checkInAt: Date,
  shift: Pick<
    Shift,
    | 'end_time'
    | 'is_night_shift'
    | 'overtime_grace_minutes'
    | 'max_session_hours'
    | 'sync_buffer_minutes'
  >,
): Date {
  const shiftEnd = resolveShiftEndDatetime(checkInAt, shift);

  const graceMinutes = safeNumber(shift.overtime_grace_minutes, 120);
  const syncBuffer = safeNumber(shift.sync_buffer_minutes, 0);
  // Never allow 0 here — that would set the duration cap to the check-in time and
  // auto-checkout would fire immediately. Default to a sane 14h cap.
  const maxRaw = safeNumber(shift.max_session_hours, 14);
  const maxSessionHours = maxRaw > 0 ? maxRaw : 14;

  const timeCap = new Date(shiftEnd);
  timeCap.setMinutes(timeCap.getMinutes() + graceMinutes + syncBuffer);

  const durationCap = new Date(checkInAt);
  durationCap.setMinutes(
    durationCap.getMinutes() + Math.round(maxSessionHours * 60),
  );

  return timeCap < durationCap ? timeCap : durationCap;
}

// ─── Daily materialization engine (attendance-daily-cron.md) ──────────────────

const DOW_INDEX_TO_ENUM: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

/** Maps a YYYY-MM-DD date string to its DayOfWeek enum (UTC, calendar-stable). */
export function dayOfWeekFromDate(dateStr: string): DayOfWeek {
  const idx = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return DOW_INDEX_TO_ENUM[idx];
}

/** Ordinal week of the month for a date (1 for days 1–7, 2 for 8–14, …). */
export function getWeekOfMonth(dateStr: string): number {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDate();
  return Math.floor((day - 1) / 7) + 1;
}

/** Yesterday's local date as YYYY-MM-DD (the day the 1 AM job materializes). */
export function getYesterdayLocalDate(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return todayLocalDate(d);
}

/**
 * Whether a date is a scheduled weekly-off under a WeeklyOff config, honoring
 * the Saturday rule (all/odd/even/custom weeks). Mirrors the entity semantics.
 */
export function isWeeklyOffDay(dateStr: string, weeklyOff: WeeklyOff): boolean {
  const dow = dayOfWeekFromDate(dateStr);
  const days = weeklyOff.days ?? [];

  // Fixed off-days other than Saturday (Saturday is governed by saturday_rule).
  if (dow !== DayOfWeek.SATURDAY && days.includes(dow)) return true;

  if (dow === DayOfWeek.SATURDAY) {
    const weekNum = getWeekOfMonth(dateStr);
    switch (weeklyOff.saturday_rule) {
      case SaturdayRule.ALL_OFF:
        return true;
      case SaturdayRule.ALL_WORKING:
        return false;
      case SaturdayRule.ODD_OFF:
        return weekNum % 2 === 1; // 1st, 3rd, 5th
      case SaturdayRule.EVEN_OFF:
        return weekNum % 2 === 0; // 2nd, 4th
      case SaturdayRule.CUSTOM:
        return weeklyOff.saturday_off_weeks?.includes(weekNum) ?? false;
      default:
        // No explicit rule: fall back to whether SATURDAY is in the days list.
        return (weeklyOff.days ?? []).includes(DayOfWeek.SATURDAY);
    }
  }

  return false;
}
