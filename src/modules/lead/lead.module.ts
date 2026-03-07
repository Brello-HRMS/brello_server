import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Lead } from './entities/lead.entity';
import { Otp } from '../auth/entities/otp.entity';
import { User } from '../user/entities/user.entity';
import { LeadController } from './controllers/lead.controller';
import { LeadService } from './services/lead.service';
import { LeadRepository } from './repositories/lead.repository';
import { OtpRepository } from '../auth/repositories/otp.repository';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, Otp, User]),
    ConfigModule,
    NotificationModule,
  ],
  controllers: [LeadController],
  providers: [LeadService, LeadRepository, OtpRepository],
  exports: [LeadService],
})
export class LeadModule {}
