import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../../role/entities/role.entity';
import { User } from '../../user/entities/user.entity';


/**
 * UserRoleMap Entity
 *
 * Junction table mapping users to roles in a specific organization.
 * A user can have multiple roles across multiple apps.
 * Does NOT extend BaseEntity to keep it lean (no status/code/description).
 */
@Entity('user_role_map')
@Index(['user_id', 'role_id', 'organization_id'], { unique: true })
@Index(['user_id', 'organization_id'])
export class UserRoleMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The user being assigned the role */
  @Column({ type: 'uuid' })
  user_id: string;

  /** The role being assigned */
  @Column({ type: 'uuid' })
  role_id: string;

  @ManyToOne(() => Role, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;


  /** Organization scope for this role assignment */
  @Column({ type: 'uuid' })
  organization_id: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
