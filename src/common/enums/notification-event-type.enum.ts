export enum NotificationEventType {
  // Leave
  LEAVE_SUBMITTED = 'leave.submitted',
  LEAVE_APPROVED = 'leave.approved',
  LEAVE_REJECTED = 'leave.rejected',
  LEAVE_CANCELLED = 'leave.cancelled',

  // Reimbursement
  REIMBURSEMENT_SUBMITTED = 'reimbursement.submitted',
  REIMBURSEMENT_APPROVED = 'reimbursement.approved',
  REIMBURSEMENT_REJECTED = 'reimbursement.rejected',
  REIMBURSEMENT_PAID = 'reimbursement.paid',

  // Attendance
  ATTENDANCE_AUTO_CHECKOUT = 'attendance.auto_checkout',
  ATTENDANCE_CORRECTION_APPROVED = 'attendance.correction.approved',
  ATTENDANCE_CORRECTION_REJECTED = 'attendance.correction.rejected',

  // Payroll
  PAYROLL_REMINDER = 'payroll.reminder',

  // Employee
  EMPLOYEE_INVITED = 'employee.invited',
  EMPLOYEE_ACTIVATED = 'employee.activated',

  // Billing
  BILLING_TRIAL_REMINDER = 'billing.trial_reminder',
  BILLING_SUBSCRIPTION_EXPIRED = 'billing.subscription_expired',
  BILLING_GRACE_PERIOD = 'billing.grace_period',

  // Auth — always enabled, cannot be turned off by users
  AUTH_OTP = 'auth.otp',

  // Letter Management
  LETTER_VIEWED = 'letter.viewed',
  LETTER_ACKNOWLEDGED = 'letter.acknowledged',
}
