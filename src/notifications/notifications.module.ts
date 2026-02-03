import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { getMailConfig } from './config/mail-config.factory';
import { InvoiceService } from './invoice/invoice.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDev = configService.get('NODE_ENV') === 'development';

        // 🔍 DEBUG - Imprime la configuración SMTP
        console.log('📧 EMAIL CONFIG:', {
          host: configService.get('SMTP_HOST') || 'smtp.resend.com',
          port: configService.get('SMTP_PORT') || '587',
          user: configService.get('SMTP_USER'),
          hasPass: !!configService.get('SMTP_PASS'),
          from: configService.get('EMAIL_FROM'),
        });

        return {
          transport: getMailConfig(configService),
          defaults: {
            from: configService.get('EMAIL_FROM'),
          },
          template: {
            dir: join(process.cwd(), 'dist', 'notifications', 'templates'),
            adapter: new HandlebarsAdapter(undefined, {
              inlineCssEnabled: false,
            }),
          },
          options: {
            strict: true,
          },
        };
      },
    }),
  ],
  providers: [NotificationsService, InvoiceService],
  exports: [NotificationsService, InvoiceService],
})
export class NotificationsModule {}
