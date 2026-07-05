import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LetterSettings } from './entities/letter-settings.entity';
import { LetterSettingsRepository } from './repositories/letter-settings.repository';
import { LetterSettingsService } from './services/letter-settings.service';
import { LetterSettingsController } from './controllers/letter-settings.controller';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [TypeOrmModule.forFeature([LetterSettings]), RbacModule],
  controllers: [LetterSettingsController],
  providers: [LetterSettingsRepository, LetterSettingsService],
  // Repository export is required — the future NumberingService (in
  // shared/) needs it directly to lock the settings row inside its own
  // in-flight transaction, not through the service layer.
  exports: [LetterSettingsService, LetterSettingsRepository],
})
export class LetterSettingsModule {}
