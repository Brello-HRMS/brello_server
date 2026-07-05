/**
 * Variable Registry — the single source of truth for every placeholder a
 * letter template may use. Templates never invent variables; the resolver
 * never resolves anything outside this catalog.
 */

export type VariableCategory =
  | 'Employee'
  | 'Employment'
  | 'Payroll'
  | 'Organization'
  | 'System'
  | 'Signatory';

export type VariableFormatter = 'text' | 'date' | 'currency' | 'phone';

export interface VariableDefinition {
  key: string;
  label: string;
  category: VariableCategory;
  description: string;
  nullable: boolean;
  editable: boolean;
  formatter: VariableFormatter;
}

export const VARIABLE_REGISTRY: VariableDefinition[] = [
  // Employee
  {
    key: 'employee_name',
    label: 'Employee Name',
    category: 'Employee',
    description: "Employee's full name",
    nullable: false,
    editable: false,
    formatter: 'text',
  },
  {
    key: 'employee_code',
    label: 'Employee Code',
    category: 'Employee',
    description: "Employee's unique code",
    nullable: true,
    editable: false,
    formatter: 'text',
  },
  {
    key: 'doj',
    label: 'Date of Joining',
    category: 'Employee',
    description: 'Date the employee joined the organization',
    nullable: true,
    editable: false,
    formatter: 'date',
  },

  // Employment
  {
    key: 'designation',
    label: 'Designation',
    category: 'Employment',
    description: "Employee's current designation",
    nullable: true,
    editable: false,
    formatter: 'text',
  },
  {
    key: 'department',
    label: 'Department',
    category: 'Employment',
    description: "Employee's current department",
    nullable: true,
    editable: false,
    formatter: 'text',
  },

  // Payroll
  {
    key: 'ctc',
    label: 'CTC',
    category: 'Payroll',
    description: "Employee's current annual CTC",
    nullable: true,
    editable: false,
    formatter: 'currency',
  },

  // Organization
  {
    key: 'organization_name',
    label: 'Organization Name',
    category: 'Organization',
    description: 'Legal name of the organization',
    nullable: false,
    editable: false,
    formatter: 'text',
  },
  {
    key: 'organization_address',
    label: 'Organization Address',
    category: 'Organization',
    description: "Organization's registered address",
    nullable: true,
    editable: false,
    formatter: 'text',
  },

  // System
  {
    key: 'today_date',
    label: "Today's Date",
    category: 'System',
    description: 'The date the letter is generated',
    nullable: false,
    editable: false,
    formatter: 'date',
  },
  {
    key: 'letter_number',
    label: 'Letter Number',
    category: 'System',
    description: 'The reserved letter number for this issuance',
    nullable: false,
    editable: false,
    formatter: 'text',
  },

  // Signatory
  {
    key: 'signatory_name',
    label: 'Signatory Name',
    category: 'Signatory',
    description: 'Name of the person signing the letter',
    nullable: true,
    editable: false,
    formatter: 'text',
  },
  {
    key: 'signatory_designation',
    label: 'Signatory Designation',
    category: 'Signatory',
    description: 'Designation of the person signing the letter',
    nullable: true,
    editable: false,
    formatter: 'text',
  },
];

export const VARIABLE_KEYS = new Set(VARIABLE_REGISTRY.map((v) => v.key));

export function isKnownVariable(key: string): boolean {
  return VARIABLE_KEYS.has(key);
}

export function groupVariablesByCategory(): Array<{
  category: VariableCategory;
  variables: VariableDefinition[];
}> {
  const order: VariableCategory[] = [
    'Employee',
    'Employment',
    'Payroll',
    'Organization',
    'System',
    'Signatory',
  ];
  return order.map((category) => ({
    category,
    variables: VARIABLE_REGISTRY.filter((v) => v.category === category),
  }));
}

/** Extracts unique {{placeholder}} keys from a set of text fragments, in first-seen order. */
export function extractVariableKeys(fragments: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const fragment of fragments) {
    const matches = fragment.match(/\{\{(\w+)\}\}/g) ?? [];
    for (const match of matches) {
      const key = match.slice(2, -2);
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    }
  }
  return ordered;
}
