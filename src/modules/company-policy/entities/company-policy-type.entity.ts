import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * CompanyPolicyType Entity
 * 
 * Master table for policy categories. 
 * Can be system-defined (org_id is null) or custom (org-scoped).
 */
@Entity('company_policy_types')
@Index(['organization_id'])
export class CompanyPolicyType extends BaseEntity {

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    icon: string;

    @Column({ type: 'boolean', default: false })
    is_system: boolean;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;
}
