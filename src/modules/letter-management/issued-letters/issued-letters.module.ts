import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuedLetter } from './entities/issued-letter.entity';
import { IssuedLetterRepository } from './repositories/issued-letter.repository';
import { IssuedLetterService } from './services/issued-letter.service';
import { IssuedLetterController } from './controllers/issued-letter.controller';
import { LetterTemplatesModule } from '../templates/letter-templates.module';
import { LetterSharedModule } from '../shared/letter-shared.module';
import { DocumentModule } from '../../document/document.module';
import { NotificationModule } from '../../notification/notification.module';
import { UserModule } from '../../user/user.module';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IssuedLetter]),
    LetterTemplatesModule,
    LetterSharedModule,
    DocumentModule,
    NotificationModule,
    UserModule,
    RbacModule,
  ],
  controllers: [IssuedLetterController],
  providers: [IssuedLetterRepository, IssuedLetterService],
  exports: [IssuedLetterService],
})
export class IssuedLettersModule {}
