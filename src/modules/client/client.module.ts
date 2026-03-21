import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { ClientRepository } from './repositories/client.repository';
import { ClientService } from './services/client.service';
import { ClientController } from './controllers/client.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Client])],
  controllers: [ClientController],
  providers: [ClientService, ClientRepository],
  exports: [ClientService, ClientRepository],
})
export class ClientModule {}
