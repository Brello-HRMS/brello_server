import { Entity, Column, OneToMany } from 'typeorm';

// Enterprise Entity - Represents the top-level tenant in the multi-tenant architecture
@Entity('enterprises')
export class Enterprise {
    // Unique identifier for the enterprise
    @Column({ primary: true, type: 'uuid', generated: 'uuid' })
    id: string;

    // Name of the enterprise
    @Column({ type: 'varchar', length: 255 })
    name: string;

    // Domain name associated with the enterprise
    @Column({ type: 'varchar', length: 255 })
    domain: string;

    // Timestamp when the enterprise was created
    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    // Timestamp when the enterprise was last updated
    @Column({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
    })
    updated_at: Date;
}
