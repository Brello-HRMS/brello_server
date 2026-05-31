import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('designations')
@Index('IDX_DESIGNATION_ORG_CODE', ['org_id', 'code'], { unique: true })
export class Designation extends BaseEntity {
    // null for platform-admin default templates; set to org UUID for org-specific records
    @Column({ type: 'uuid', nullable: true })
    org_id: string | null;

    @ManyToOne(() => Organization, { eager: false })
    @JoinColumn({ name: 'org_id' })
    organization: Organization;

    @Column({ type: 'uuid', nullable: true })
    department_id: string | null;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @Column({ type: 'boolean', default: false })
    is_default: boolean;
}
