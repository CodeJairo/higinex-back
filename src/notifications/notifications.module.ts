import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { InvoiceService } from './invoice/invoice.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get('SMTP_HOST'),
          port: configService.get('SMTP_PORT'),
          secure: configService.get('SMTP_PORT') === 465,
          auth: {
            user:
              configService.get('SMTP_User') || configService.get('SMTP_USER'),
            pass:
              configService.get('SMTP_Pass') || configService.get('SMTP_PASS'),
          },
        },
        defaults: {
          from: configService.get('EMAIL_FROM'),
        },
        template: {
          dir: join(__dirname, 'templates'), // Fixed path
          adapter: new HandlebarsAdapter(undefined, {
            inlineCssEnabled: false,
          }),
        },
        options: {
          strict: true,
        },
      }),
    }),
  ],
  providers: [NotificationsService, InvoiceService],
  exports: [NotificationsService, InvoiceService],
})
export class NotificationsModule { }
