/**
 * TimesheetSubmissionStatus Enum
 *
 * Controls the lifecycle of a timesheet entry from creation through approval.
 * The PENDING_APPROVAL, APPROVED, and REJECTED values are reserved for the
 * future approval workflow and require no schema changes when implemented.
 */
export enum TimesheetSubmissionStatus {
  /** Saved locally by the employee, not yet submitted for review */
  DRAFT = 'DRAFT',

  /** Submitted by the employee and awaiting manager action */
  SUBMITTED = 'SUBMITTED',

  /** Under active review by an approver */
  PENDING_APPROVAL = 'PENDING_APPROVAL',

  /** Approved by the manager */
  APPROVED = 'APPROVED',

  /** Rejected by the manager (reason stored in notes or future rejection_reason column) */
  REJECTED = 'REJECTED',
}
