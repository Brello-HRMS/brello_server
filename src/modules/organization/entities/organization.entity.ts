import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Enterprise } from '../../enterprise/entities/enterprise.entity';

// Organization Entity - Represents the second level in the multi-tenant architecture
@Entity('organizations')
export class Organization {
    // Unique identifier for the organization
    @Column({ primary: true, type: 'uuid', generated: 'uuid' })
    id: string;

    // Name of the organization
    @Column({ type: 'varchar', length: 255 })
    name: string;

    // Reference to the parent enterprise
    @Column({ type: 'uuid' })
    enterprise_id: string;

    // Many-to-One relationship with Enterprise
    @ManyToOne(() => Enterprise, { eager: false })
    @JoinColumn({ name: 'enterprise_id' })
    enterprise: Enterprise;

    // Timestamp when the organization was created
    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    // Timestamp when the organization was last updated
    @Column({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
    })
    updated_at: Date;
}
