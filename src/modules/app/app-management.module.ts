import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { App } from './entities/app.entity';

/**
 * AppManagementModule
 *
 * Manages app definitions in the multi-app architecture.
 * Named AppManagementModule to avoid conflict with NestJS's standard
 * 'AppModule' root module convention.
 *
 * Exports TypeOrmModule so App entity is available to other modules.
 */
@Module({
    imports: [TypeOrmModule.forFeature([App])],
    exports: [TypeOrmModule],
})
export class AppManagementModule { }
