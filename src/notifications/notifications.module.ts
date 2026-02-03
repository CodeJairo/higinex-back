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

        const transportConfig = getMailConfig(configService);
        const provider = configService.get('EMAIL_PROVIDER');

        // 🔍 DEBUG - Imprime la configuración REAL que se usará
        console.log('📧 EMAIL CONFIG (Actual):', {
          provider,
          config: {
            ...transportConfig,
            auth: {
              user: transportConfig.auth?.user,
              pass: transportConfig.auth?.pass ? '******' : undefined, // Hide password
            },
          },
        });

        return {
          transport: transportConfig,
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
