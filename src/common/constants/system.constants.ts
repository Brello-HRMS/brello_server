/**
 * Sentinel identity for actions performed by the system itself (cron jobs,
 * materialization engine, auto-checkout) rather than an authenticated user.
 *
 * Used for `modified_by` (nullable) and audit `performed_by` (NOT nullable),
 * so a stable non-null UUID is required. It is an all-zero UUID that will never
 * collide with a real user id.
 */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
