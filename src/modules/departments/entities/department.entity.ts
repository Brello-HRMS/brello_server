import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('departments')
@Index(['organization_id', 'code'], { unique: true })
export class Department extends BaseEntity {

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    icon: string;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @Column({ type: 'boolean', default: false })
    is_default: boolean;
}
