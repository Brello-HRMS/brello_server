/**
 * Lifecycle of an auto-checkout correction request. Stored on the request and
 * mirrored onto attendance_records.correction_status.
 * CLOSED = correction window (7 days) expired with no action.
 */
export enum CorrectionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}
