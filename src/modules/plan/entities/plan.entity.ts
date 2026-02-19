import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Plan Entity
 *
 * Represents subscription plans available in the system (e.g., Free, Starter, Enterprise).
 * Plans control which modules and actions are accessible to organizations.
 */
@Entity('plan')
@Index(['name'], { unique: true })
export class Plan extends BaseEntity {
    /** Plan name (e.g., Free, Starter, Professional, Enterprise) */
    @Column({ type: 'varchar', length: 100, unique: true })
    name: string;

    /** Monthly/annual pricing in smallest currency unit (e.g., paise/cents) */
    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    price: number;
}
