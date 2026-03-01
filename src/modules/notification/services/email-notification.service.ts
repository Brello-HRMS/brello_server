import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SendNotificationDto } from '../dto/send-notification.dto';

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.configService.get<string>('smtp.host');
    const port = this.configService.get<number>('smtp.port');
    const secure = this.configService.get<boolean>('smtp.secure');
    const user = this.configService.get<string>('smtp.user');
    const pass = this.configService.get<string>('smtp.password');

    if (!host || !port || !user || !pass) {
      throw new Error('SMTP configuration is incomplete');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Send an email notification.
   */
  async send(dto: SendNotificationDto): Promise<void> {
    const from = this.configService.get<string>('smtp.from');
    const to = dto.target_email;

    if (!to) {
      this.logger.error('Cannot send email: missing target_email.');
      return;
    }

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: dto.title,
        text: dto.message,
        html: `<p>${dto.message}</p>`,
      });

      this.logger.log(`Email successfully sent to ${to} from ${from}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error.message}`,
        error.stack,
      );
    }
  }
}
