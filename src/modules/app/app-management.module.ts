import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { App } from './entities/app.entity';
import { AppService } from './services/app.service';
import { AppController } from './controllers/app.controller';

import { AppRepository } from './repositories/app.repository';

@Module({
  imports: [TypeOrmModule.forFeature([App])],
  controllers: [AppController],
  providers: [AppService, AppRepository],
  exports: [AppService, AppRepository, TypeOrmModule],
})
export class AppManagementModule {}
