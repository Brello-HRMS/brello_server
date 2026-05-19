import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalSearchModule } from '../global-search/global-search.module';
import { Role } from './entities/role.entity';
import { RoleService } from './services/role.service';
import { RoleRepository } from './repositories/role.repository';
import { RoleController } from './controllers/role.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Role]), GlobalSearchModule],
  controllers: [RoleController],
  providers: [RoleService, RoleRepository],
  exports: [RoleService],
})
export class RoleModule {}
