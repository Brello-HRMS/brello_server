import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { App } from './entities/app.entity';
import { AppService } from './services/app.service';
import { AppController } from './controllers/app.controller';

/**
 * AppManagementModule
 *
 * Manages app definitions in the multi-app architecture.
 * Provides CRUD APIs for application registration.
 */
@Module({
    imports: [TypeOrmModule.forFeature([App])],
    controllers: [AppController],
    providers: [AppService],
    exports: [AppService, TypeOrmModule],
})
export class AppManagementModule { }
