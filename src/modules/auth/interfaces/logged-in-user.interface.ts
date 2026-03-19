/**
 * LoggedInUser Interface
 *
 * Defines the standardized payload for authenticated users across all APIs.
 * This object is attached to the request by LoggedInUserInterceptor.
 */
export interface LoggedInUser {
  /** User's unique identifier */
  userId: string;

  /** Enterprise the user belongs to */
  enterpriseId: string;

  /** Organization the user is acting within */
  organizationId: string;

  /** Currently active application ID */
  appId: string;

  /** Identifies if the user is a Platform Admin */
  isPlatformAdmin: boolean;
}
