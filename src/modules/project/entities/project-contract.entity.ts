import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('project_contracts')
export class ProjectContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  project_id: string;

  @ManyToOne(() => Project, (project) => project.contracts)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'varchar', length: 255 })
  file_name: string;

  @Column({ type: 'text' })
  file_url: string;

  @Column({ type: 'varchar', length: 50 })
  file_type: string;

  @CreateDateColumn({ type: 'timestamp' })
  uploaded_at: Date;

  @Column({ type: 'uuid' })
  uploaded_by: string;
}
