/**
 * Timesheet Calculation Utilities
 *
 * Pure, deterministic functions with no side effects.
 * All time values use HH:MM 24-hour string format internally.
 */

/**
 * Converts a "HH:MM" string to total minutes since midnight.
 * e.g. "09:30" → 570
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * Returns true when end_time is strictly after start_time.
 * Prevents zero-duration and backward entries.
 */
export function isEndAfterStart(startTime: string, endTime: string): boolean {
  return parseTimeToMinutes(endTime) > parseTimeToMinutes(startTime);
}

/**
 * Computes the duration between two HH:MM strings in minutes.
 * Assumes end_time > start_time (call isEndAfterStart first).
 */
export function calcWorkedMinutes(startTime: string, endTime: string): number {
  return parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
}

/**
 * Formats total minutes into a human-readable "HH:MM" string.
 * e.g. 90 → "01:30"
 */
export function formatMinutesToHours(totalMinutes: number): string {
  const h = Math.floor(Math.max(0, totalMinutes) / 60);
  const m = Math.max(0, totalMinutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Returns ISO date strings for the Monday–Sunday week that contains the given date.
 * Used for "Hours This Week" dashboard aggregation.
 */
export function getWeekBoundaries(date: Date): {
  weekStart: string;
  weekEnd: string;
} {
  const day = date.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    weekStart: toIsoDate(monday),
    weekEnd: toIsoDate(sunday),
  };
}

/**
 * Formats a Date object to a YYYY-MM-DD string without timezone conversion.
 */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
