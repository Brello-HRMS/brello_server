import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { App } from '../../app/entities/app.entity';
import { RoleContext } from '../enums/role-context.enum';

@Entity('roles')
@Index(['app_id', 'organization_id', 'name'])
export class Role extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'uuid' })
  app_id: string;

  @ManyToOne(() => App, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  app: App;

  @Column({ type: 'enum', enum: RoleContext, default: RoleContext.EMPLOYEE })
  context: RoleContext;

  @Column({ type: 'boolean', default: false })
  is_system_defined: boolean;
}
