export enum PayrollFrequency {
  MONTHLY = 'monthly',
}

export enum ComponentType {
  EARNING = 'earning',
  DEDUCTION = 'deduction',
  BONUS = 'bonus',
}

export enum ComponentCategory {
  FIXED = 'fixed',
  VARIABLE = 'variable',
  STATUTORY = 'statutory',
}

export enum CalculationType {
  FIXED = 'fixed',
  PERCENTAGE = 'percentage',
  RESIDUAL = 'residual',
}

export enum PayoutType {
  LAST_WORKING_DAY = 'last_working_day',
  FIRST_WORKING_DAY = 'first_working_day',
  CUSTOM = 'custom',
}

export enum PayoutDayShift {
  PREVIOUS = 'previous',
  NEXT = 'next',
}

export enum AttendanceCutoffType {
  DAYS_BEFORE_MONTH_END = 'days_before_month_end',
  FIXED_DATE = 'fixed_date',
}

export enum FinancialMonth {
  JAN = 'jan',
  FEB = 'feb',
  MAR = 'mar',
  APR = 'apr',
  MAY = 'may',
  JUN = 'jun',
  JUL = 'jul',
  AUG = 'aug',
  SEP = 'sep',
  OCT = 'oct',
  NOV = 'nov',
  DEC = 'dec',
}

export enum PropagationScope {
  FUTURE_ONLY = 'future_only',
  SELECTED_EMPLOYEES = 'selected_employees',
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}
