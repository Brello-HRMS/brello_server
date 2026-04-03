/**
 * Assignment Type Enum
 *
 * Defines how an attendance rule is assigned.
 * Employee-level assignments override department-level assignments.
 */
export enum AssignmentType {
  /** Rule assigned at department level (applies to all employees in dept) */
  DEPARTMENT = 'DEPARTMENT',

  /** Rule assigned directly to an employee (overrides department rule) */
  EMPLOYEE = 'EMPLOYEE',
}
