import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { User } from '../../user/entities/user.entity';

@Entity('project_team_mappings')
export class ProjectTeam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  project_id: string;

  @ManyToOne(() => Project, (project) => project.team)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  role: string;

  @CreateDateColumn({ type: 'timestamp' })
  assigned_at: Date;

  @Column({ type: 'uuid' })
  assigned_by: string;
}
