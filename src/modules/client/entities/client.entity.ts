import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Project } from '../../project/entities/project.entity';

@Entity('clients')
export class Client extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  poc_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  poc_email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  poc_phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo: string;

  @OneToMany(() => Project, (project) => project.client)
  projects: Project[];

  projects_count: number;
}
