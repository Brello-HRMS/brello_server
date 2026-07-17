/**
 * EmailProvider Enum
 *
 * Identifies which upstream provider an email integration is connected to.
 * Only Gmail (send-only OAuth) is supported today; the enum leaves room for
 * additional providers (e.g. Outlook) without a schema change.
 */
export enum EmailProvider {
  GMAIL = 'gmail',
}
