import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';
import { App } from '../../app/entities/app.entity';

@Entity('role_apps')
@Index(['role_id', 'app_id'], { unique: true })
export class RoleApp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  role_id: string;

  @ManyToOne(() => Role, (role) => role.roleApps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ type: 'uuid' })
  app_id: string;

  @ManyToOne(() => App, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  app: App;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
