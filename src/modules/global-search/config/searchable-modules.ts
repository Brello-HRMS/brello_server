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
    permission: 'employee.read',
  },
  {
    module_key: 'departments',
    label: 'Departments',
    route: '/organisation/departments',
    permission: 'department.read',
  },
  {
    module_key: 'designations',
    label: 'Designations',
    route: '/organisation/designations',
    permission: 'designation.read',
  },
  {
    module_key: 'clients',
    label: 'Clients',
    route: '/project/clients',
    permission: 'client.read',
  },
  {
    module_key: 'projects',
    label: 'Projects',
    route: '/project/projects',
    permission: 'project.read',
  },
  {
    module_key: 'announcements',
    label: 'Announcements',
    route: '/announcements/list',
    permission: 'announcement.read',
  },
  {
    module_key: 'company_policies',
    label: 'Policies',
    route: '/organisation/policies',
    permission: 'policy.read',
  },
  {
    module_key: 'roles',
    label: 'Roles',
    route: '/access/roles',
    permission: 'role.read',
  },
  {
    module_key: 'holidays',
    label: 'Holidays',
    route: '/attendance/holidays',
    permission: 'holiday.read',
  },
  {
    module_key: 'reimbursements',
    label: 'Reimbursements',
    route: '/reimbursement/list',
    permission: 'reimbursement.read',
  },
];
