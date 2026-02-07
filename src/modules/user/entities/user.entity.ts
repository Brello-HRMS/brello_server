import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

// User Entity - Represents users in the system
@Entity('users')
@Index(['email'], { unique: true })
@Index(['phone'], { unique: true })
export class User extends BaseEntity {
    // User's first name
    @Column({ type: 'varchar', length: 100 })
    first_name: string;

    // User's middle name
    @Column({ type: 'varchar', length: 100, nullable: true })
    middle_name: string;

    // User's last name
    @Column({ type: 'varchar', length: 100 })
    last_name: string;

    // User's email address
    @Column({ type: 'varchar', length: 255, unique: true })
    email: string;

    // User's phone number
    @Column({ type: 'varchar', length: 20, unique: true })
    phone: string;

    // Hashed password
    @Column({ type: 'varchar', length: 255 })
    password_hash: string;

    // Computed full name
    get fullName(): string {
        const names = [this.first_name, this.middle_name, this.last_name].filter(
            Boolean,
        );
        return names.join(' ');
    }
}
