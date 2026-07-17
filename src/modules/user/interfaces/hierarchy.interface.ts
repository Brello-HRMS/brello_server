/**
 * Hierarchy interfaces
 *
 * Shape of the nodes returned by the company-structure / user-hierarchy APIs.
 * Built in-memory from the self-referencing `reports_to_id` on the users table.
 */

/** A single person in the org hierarchy. */
export interface HierarchyNode {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  designation: string | null;
  department: string | null;
  avatar: string | null;
  /** Manager (reports-to) user id, null for top-of-tree. */
  reportsToId: string | null;
  /** Number of people who directly report to this person. */
  directReportsCount: number;
  /** Number of people at any depth beneath this person. */
  totalReportsCount: number;
  /** Direct reportees. Populated for tree/recursive responses, [] otherwise. */
  children: HierarchyNode[];
}

/** Response for the logged-in user's own hierarchy ("My Team"). */
export interface MyHierarchy {
  /** The caller, with their reportee subtree under `children`. */
  self: HierarchyNode;
  /** Manager chain from direct manager (first) up to the top (last). */
  managers: HierarchyNode[];
}
