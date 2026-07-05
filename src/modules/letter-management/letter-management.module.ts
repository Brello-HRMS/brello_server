import { Module } from '@nestjs/common';
import { LetterCategoriesModule } from './categories/letter-categories.module';
import { SignatoriesModule } from './signatories/signatories.module';
import { LetterSettingsModule } from './settings/letter-settings.module';
import { LetterTemplatesModule } from './templates/letter-templates.module';
import { LetterSharedModule } from './shared/letter-shared.module';
import { IssuedLettersModule } from './issued-letters/issued-letters.module';

@Module({
  imports: [
    LetterCategoriesModule,
    SignatoriesModule,
    LetterSettingsModule,
    LetterTemplatesModule,
    LetterSharedModule,
    IssuedLettersModule,
  ],
})
export class LetterManagementModule {}
