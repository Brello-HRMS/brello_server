import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalSearchModule } from '../global-search/global-search.module';
import { Client } from './entities/client.entity';
import { ClientRepository } from './repositories/client.repository';
import { ClientService } from './services/client.service';
import { ClientController } from './controllers/client.controller';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([Client]), RbacModule, GlobalSearchModule],
  controllers: [ClientController],
  providers: [ClientService, ClientRepository],
  exports: [ClientService, ClientRepository],
})
export class ClientModule {}
