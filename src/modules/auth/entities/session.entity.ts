import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../user/entities/user.entity';

// Session Entity - Tracks user sessions for authentication and security
@Entity('sessions')
@Index(['user_id'])
@Index(['refresh_token_hash'])
export class Session {
    // Unique identifier for the session
    @Column({ primary: true, type: 'uuid', generated: 'uuid' })
    id: string;

    // Reference to the user who owns this session
    @Column({ type: 'uuid' })
    user_id: string;

    // Many-to-One relationship with User
    @ManyToOne(() => User, { eager: false })
    @JoinColumn({ name: 'user_id' })
    user: User;

    // Hashed refresh token
    @Column({ type: 'varchar', length: 255 })
    refresh_token_hash: string;

    // Device fingerprint for security
    @Column({ type: 'varchar', length: 500 })
    device_fingerprint: string;

    // Timestamp when the user logged in
    @Column({ type: 'timestamp' })
    login_time: Date;

    // Timestamp of last activity
    @Column({ type: 'timestamp' })
    last_activity: Date;

    // Timestamp when the user logged out
    @Column({ type: 'timestamp', nullable: true })
    logout_time: Date;

    // Hard expiration time for the refresh token
    @Column({ type: 'timestamp' })
    expires_at: Date;

    // Application ID (for multi-app support)
    @Column({ type: 'uuid', nullable: true })
    app_id: string;
}
