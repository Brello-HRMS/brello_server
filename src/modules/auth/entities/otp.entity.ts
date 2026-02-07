import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { OtpPurpose } from '../../../common/enums';

// OTP Entity - Stores One-Time Passwords for various purposes
@Entity('otps')
@Index(['identifier', 'purpose'])
@Index(['user_id'])
export class Otp {
    // Unique identifier for the OTP record
    @Column({ primary: true, type: 'uuid', generated: 'uuid' })
    id: string;

    // Identifier (email or phone number)
    @Column({ type: 'varchar', length: 255 })
    identifier: string;

    // Hashed OTP value
    @Column({ type: 'varchar', length: 255 })
    otp_hash: string;

    // Reference to the user (if applicable)
    @Column({ type: 'uuid', nullable: true })
    user_id: string;

    // Many-to-One relationship with User
    @ManyToOne(() => User, { eager: false })
    @JoinColumn({ name: 'user_id' })
    user: User;

    // Purpose of the OTP
    @Column({
        type: 'enum',
        enum: OtpPurpose,
    })
    purpose: OtpPurpose;

    // Expiration timestamp
    @Column({ type: 'timestamp' })
    expires_at: Date;

    // Number of verification attempts
    @Column({ type: 'int', default: 0 })
    attempts_count: number;

    // Timestamp when the OTP was created
    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
}
