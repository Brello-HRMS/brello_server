/**
 * Status Enum
 *
 * Represents the lifecycle status of entities in the system.
 * Used for soft deletion and entity state management.
 */
export enum Status {
  /** Entity is active and available for use */
  ACTIVE = 'ACTIVE',

  /** Entity is temporarily inactive but not deleted */
  INACTIVE = 'INACTIVE',

  /** Entity is soft-deleted (not physically removed from database) */
  DELETED = 'DELETED',

  /** Entity is pending approval or activation */
  PENDING = 'PENDING',

  /** Entity is archived for historical reference */
  ARCHIVED = 'ARCHIVED',
}
