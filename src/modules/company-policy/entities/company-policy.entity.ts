import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CompanyPolicyType } from './company-policy-type.entity';

/**
 * CompanyPolicy Entity
 * 
 * Represents a specific policy within an organization.
 */
@Entity('company_policies')
@Index(['organization_id', 'type_id'])
export class CompanyPolicy extends BaseEntity {

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    placeholder: string;

    @Column({ type: 'uuid' })
    type_id: string;

    @ManyToOne(() => CompanyPolicyType, { eager: false, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'type_id' })
    type: CompanyPolicyType;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;
}
