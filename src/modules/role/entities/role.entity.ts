import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { App } from 'src/modules/app/entities/app.entity';

@Entity('role')
@Index(['name'], { unique: true })
export class Role extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'uuid' })
  app_id: string;

  @ManyToOne(() => App, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  app: App;

  @Column({ type: 'boolean', default: true })
  is_system_role: boolean;
}
