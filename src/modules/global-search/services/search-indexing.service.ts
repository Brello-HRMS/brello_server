import { Injectable, Logger } from '@nestjs/common';

import {
  GlobalSearchDocumentRepository,
  UpsertSearchDocumentInput,
} from '../repositories/global-search-document.repository';

export interface IndexEmployeeInput {
  id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
}

export interface IndexDepartmentInput {
  id: string;
  name: string;
  description?: string;
}

export interface IndexDesignationInput {
  id: string;
  title: string;
  description?: string;
}

export interface IndexClientInput {
  id: string;
  name: string;
  poc_name?: string;
  poc_email?: string;
}

export interface IndexProjectInput {
  id: string;
  name: string;
  client_id: string;
  project_status?: string;
}

export interface IndexAnnouncementInput {
  id: string;
  title: string;
  priority?: string;
}

export interface IndexPolicyInput {
  id: string;
  title: string;
  description?: string;
}

export interface IndexRoleInput {
  id: string;
  name: string;
  description?: string;
}

export interface IndexHolidayInput {
  id: string;
  name: string;
  calendar_id: string;
  type?: string;
}

export interface IndexReimbursementInput {
  id: string;
  title: string;
  amount?: number;
  currency?: string;
}

@Injectable()
export class SearchIndexingService {
  private readonly logger = new Logger(SearchIndexingService.name);

  constructor(
    private readonly searchDocumentRepository: GlobalSearchDocumentRepository,
  ) {}

  private index(input: UpsertSearchDocumentInput): void {
    this.searchDocumentRepository
      .upsert(input)
      .catch((err: Error) =>
        this.logger.warn(
          `Search index failed [${input.entity_type}:${input.entity_id}]: ${err.message}`,
        ),
      );
  }

  remove(enterpriseId: string, entityId: string, entityType: string): void {
    this.searchDocumentRepository
      .softDelete(enterpriseId, entityId, entityType)
      .catch((err: Error) =>
        this.logger.warn(
          `Search deindex failed [${entityType}:${entityId}]: ${err.message}`,
        ),
      );
  }

  // ─── Employee ────────────────────────────────────────────────────────────────

  indexEmployee(
    employee: IndexEmployeeInput,
    enterpriseId: string,
    organizationId: string,
  ): void {
    const fullName = [employee.first_name, employee.middle_name, employee.last_name]
      .filter(Boolean)
      .join(' ');

    this.index({
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      entity_id: employee.id,
      entity_type: 'employee',
      module_key: 'employees',
      title: fullName,
      subtitle: employee.email,
      keywords: `${fullName} ${employee.email}`,
      route: `/employee/profile/${employee.id}`,
      permissions: ['employee.read'],
      is_active: true,
    });
  }

  removeEmployee(employeeId: string, enterpriseId: string): void {
    this.remove(enterpriseId, employeeId, 'employee');
  }

  // ─── Department ──────────────────────────────────────────────────────────────

  indexDepartment(
    department: IndexDepartmentInput,
    enterpriseId: string,
    organizationId: string,
  ): void {
    this.index({
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      entity_id: department.id,
      entity_type: 'department',
      module_key: 'departments',
      title: department.name,
      subtitle: department.description ?? '',
      keywords: department.name,
      route: `/organisation/departments/${department.id}`,
      permissions: ['department.read'],
      is_active: true,
    });
  }

  removeDepartment(departmentId: string, enterpriseId: string): void {
    this.remove(enterpriseId, departmentId, 'department');
  }

  // ─── Designation ─────────────────────────────────────────────────────────────

  indexDesignation(
    designation: IndexDesignationInput,
    enterpriseId: string,
    organizationId: string,
  ): void {
    this.index({
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      entity_id: designation.id,
      entity_type: 'designation',
      module_key: 'designations',
      title: designation.title,
      subtitle: designation.description ?? '',
      keywords: designation.title,
      route: `/organisation/designations/${designation.id}`,
      permissions: ['designation.read'],
      is_active: true,
    });
  }

  removeDesignation(designationId: string, enterpriseId: string): void {
    this.remove(enterpriseId, designationId, 'designation');
  }

  // ─── Client ──────────────────────────────────────────────────────────────────

  indexClient(
    client: IndexClientInput,
    enterpriseId: string,
    organizationId: string,
  ): void {
    this.index({
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      entity_id: client.id,
      entity_type: 'client',
      module_key: 'clients',
      title: client.name,
      subtitle: client.poc_name ?? client.poc_email ?? '',
      keywords: [client.name, client.poc_name, client.poc_email].filter(Boolean).join(' '),
      route: `/project/clients/${client.id}`,
      permissions: ['client.read'],
      is_active: true,
    });
  }

  removeClient(clientId: string, enterpriseId: string): void {
    this.remove(enterpriseId, clientId, 'client');
  }

  // ─── Project ─────────────────────────────────────────────────────────────────

  indexProject(
    project: IndexProjectInput,
    enterpriseId: string,
    organizationId: string,
  ): void {
    this.index({
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      entity_id: project.id,
      entity_type: 'project',
      module_key: 'projects',
      title: project.name,
      subtitle: project.project_status ?? '',
      keywords: project.name,
      route: `/project/clients/${project.client_id}/projects/${project.id}`,
      permissions: ['project.read'],
      is_active: true,
    });
  }

  removeProject(projectId: string, enterpriseId: string): void {
    this.remove(enterpriseId, projectId, 'project');
  }

  // ─── Announcement ────────────────────────────────────────────────────────────

  indexAnnouncement(
    announcement: IndexAnnouncementInput,
    enterpriseId: string,
    organizationId: string,
  ): void {
    this.index({
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      entity_id: announcement.id,
      entity_type: 'announcement',
      module_key: 'announcements',
      title: announcement.title,
      subtitle: announcement.priority ?? '',
      keywords: announcement.title,
      route: '/announcements/list',
      permissions: ['announcement.read'],
      is_active: true,
    });
  }

  removeAnnouncement(announcementId: string, enterpriseId: string): void {
    this.remove(enterpriseId, announcementId, 'announcement');
  }

  // ─── Company Policy ──────────────────────────────────────────────────────────

  indexPolicy(
    policy: IndexPolicyInput,
    enterpriseId: string,
    organizationId: string,
  ): void {
    this.index({
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      entity_id: policy.id,
      entity_type: 'company_policy',
      module_key: 'company_policies',
      title: policy.title,
      subtitle: policy.description ?? '',
      keywords: policy.title,
      route: '/organisation/policies',
      permissions: ['policy.read'],
      is_active: true,
    });
  }

  removePolicy(policyId: string, enterpriseId: string): void {
    this.remove(enterpriseId, policyId, 'company_policy');
  }

  // ─── Role ────────────────────────────────────────────────────────────────────

  indexRole(
    role: IndexRoleInput,
    enterpriseId: string,
    organizationId: string,
  ): void {
    this.index({
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      entity_id: role.id,
      entity_type: 'role',
      module_key: 'roles',
      title: role.name,
      subtitle: role.description ?? '',
      keywords: role.name,
      route: '/access/roles',
      permissions: ['role.read'],
      is_active: true,
    });
  }

  removeRole(roleId: string, enterpriseId: string): void {
    this.remove(enterpriseId, roleId, 'role');
  }

  // ─── Holiday ─────────────────────────────────────────────────────────────────

  indexHoliday(
    holiday: IndexHolidayInput,
    enterpriseId: string,
    organizationId: string,
  ): void {
    this.index({
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      entity_id: holiday.id,
      entity_type: 'holiday',
      module_key: 'holidays',
      title: holiday.name,
      subtitle: holiday.type ?? '',
      keywords: holiday.name,
      route: `/attendance/holidays/${holiday.calendar_id}`,
      permissions: ['holiday.read'],
      is_active: true,
    });
  }

  removeHoliday(holidayId: string, enterpriseId: string): void {
    this.remove(enterpriseId, holidayId, 'holiday');
  }

  // ─── Reimbursement ───────────────────────────────────────────────────────────

  indexReimbursement(
    reimbursement: IndexReimbursementInput,
    enterpriseId: string,
    organizationId: string,
  ): void {
    const subtitle =
      reimbursement.amount !== undefined
        ? `${reimbursement.currency ?? 'INR'} ${reimbursement.amount}`
        : '';

    this.index({
      enterprise_id: enterpriseId,
      organization_id: organizationId,
      entity_id: reimbursement.id,
      entity_type: 'reimbursement',
      module_key: 'reimbursements',
      title: reimbursement.title,
      subtitle,
      keywords: reimbursement.title,
      route: '/reimbursement/list',
      permissions: ['reimbursement.read'],
      is_active: true,
    });
  }

  removeReimbursement(reimbursementId: string, enterpriseId: string): void {
    this.remove(enterpriseId, reimbursementId, 'reimbursement');
  }
}
