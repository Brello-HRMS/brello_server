import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailIntegration } from '../entities/email-integration.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class EmailIntegrationRepository {
  constructor(
    @InjectRepository(EmailIntegration)
    private readonly repository: Repository<EmailIntegration>,
  ) {}

  async create(data: Partial<EmailIntegration>): Promise<EmailIntegration> {
    const integration = this.repository.create(data);
    return this.repository.save(integration);
  }

  async save(integration: EmailIntegration): Promise<EmailIntegration> {
    return this.repository.save(integration);
  }

  /** All non-deleted integrations for an organization, newest first. */
  async findAllForOrg(organizationId: string): Promise<EmailIntegration[]> {
    return this.repository.find({
      where: { organization_id: organizationId, status: Status.ACTIVE },
      order: { is_active: 'DESC', created_at: 'DESC' },
    });
  }

  /** A single non-deleted integration scoped to the organization. */
  async findByIdForOrg(
    id: string,
    organizationId: string,
  ): Promise<EmailIntegration | null> {
    return this.repository.findOne({
      where: { id, organization_id: organizationId, status: Status.ACTIVE },
    });
  }

  /** The organization's currently active outbound sender, if any. */
  async findActiveForOrg(
    organizationId: string,
  ): Promise<EmailIntegration | null> {
    return this.repository.findOne({
      where: {
        organization_id: organizationId,
        status: Status.ACTIVE,
        is_active: true,
      },
    });
  }

  /** An existing connection for the same Google account within the org. */
  async findByEmailForOrg(
    email: string,
    organizationId: string,
  ): Promise<EmailIntegration | null> {
    return this.repository.findOne({
      where: {
        email,
        organization_id: organizationId,
        status: Status.ACTIVE,
      },
    });
  }

  async update(
    id: string,
    data: Partial<EmailIntegration>,
  ): Promise<void> {
    await this.repository.update(id, data);
  }

  /**
   * Clears the active-sender flag for every integration of an organization.
   * Used to enforce the "one active sender per org" invariant before promoting
   * a different account.
   */
  async deactivateAllForOrg(organizationId: string): Promise<void> {
    await this.repository.update(
      { organization_id: organizationId, is_active: true },
      { is_active: false },
    );
  }
}
