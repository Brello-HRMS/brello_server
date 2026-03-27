/**
 * Holiday Type Enum
 *
 * Categorizes the type of holiday.
 */
export enum HolidayType {
  /** Mandatory national/public holiday */
  PUBLIC = 'PUBLIC',

  /** Employee-choice selection (restricted count) */
  OPTIONAL = 'OPTIONAL',

  /** Company-specific holiday (e.g., anniversary) */
  COMPANY = 'COMPANY',
}
