import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Client } from '../../client/entities/client.entity';
import {
  ProjectStatus,
  ProjectPriority,
  ProjectType,
} from '../enums/project-enums';
import { ProjectContract } from './project-contract.entity';
import { ProjectTeam } from './project-team.entity';

@Entity('projects')
@Unique(['client_id', 'name'])
export class Project extends BaseEntity {
  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => Client, (client) => client.projects)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: ProjectType,
    default: ProjectType.CLIENT,
  })
  project_type: ProjectType;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.DRAFT,
  })
  project_status: ProjectStatus;

  @Column({
    type: 'enum',
    enum: ProjectPriority,
    default: ProjectPriority.MEDIUM,
  })
  priority: ProjectPriority;

  @Column({ type: 'date', nullable: true })
  start_date: Date;

  @Column({ type: 'date', nullable: true })
  end_date: Date;

  @OneToMany(() => ProjectContract, (contract) => contract.project)
  contracts: ProjectContract[];

  @OneToMany(() => ProjectTeam, (team) => team.project)
  team: ProjectTeam[];
}
