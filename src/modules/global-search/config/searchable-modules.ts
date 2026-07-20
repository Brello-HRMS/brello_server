export interface SearchableModuleConfig {
  module_key: string;
  label: string;
  route: string;
  permission: string;
}

export const SEARCHABLE_MODULES: SearchableModuleConfig[] = [
  {
    module_key: 'employees',
    label: 'Employees',
    route: '/employee/directory',
    permission: 'EMP_DIRECTORY',
  },
  {
    module_key: 'departments',
    label: 'Departments',
    route: '/organisation/departments',
    permission: 'ORG_DEPARTMENTS',
  },
  {
    module_key: 'designations',
    label: 'Designations',
    route: '/organisation/designations',
    permission: 'ORG_DESIGNATIONS',
  },
  {
    module_key: 'clients',
    label: 'Clients',
    route: '/project/clients',
    permission: 'PROJECT_CLIENTS',
  },
  {
    module_key: 'projects',
    label: 'Projects',
    route: '/project/projects',
    permission: 'PROJECT_PROJECTS',
  },
  {
    module_key: 'announcements',
    label: 'Announcements',
    route: '/announcements/list',
    permission: 'ANNOUNCEMENT',
  },
  {
    module_key: 'company_policies',
    label: 'Policies',
    route: '/organisation/policies',
    permission: 'ORG_POLICIES',
  },
  {
    module_key: 'roles',
    label: 'Roles',
    route: '/access/roles',
    permission: 'ACCESS_ROLES',
  },
  {
    module_key: 'holidays',
    label: 'Holidays',
    route: '/attendance/holidays',
    permission: 'LEAVE_HOLIDAYS',
  },
  {
    module_key: 'reimbursements',
    label: 'Reimbursements',
    route: '/reimbursement/list',
    permission: 'REIMBURSEMENT',
  },
];
