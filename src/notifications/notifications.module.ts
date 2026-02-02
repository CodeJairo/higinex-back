import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { InvoiceService } from './invoice/invoice.service';
import { NotificationsService } from './notifications.service';

function cleanEnv(val: string | undefined): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

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
          transport: {
            host: configService.get('SMTP_HOST', 'smtp.resend.com'),
            port: parseInt(configService.get('SMTP_PORT') || '587', 10),
            secure: false, // true for 465, false for other ports
            auth: {
              user: cleanEnv(configService.get<string>('SMTP_USER')),
              pass: cleanEnv(configService.get<string>('SMTP_PASS')),
            },
            tls: {
              ciphers: 'SSLv3',
            },
            logger: isDev,
            debug: isDev,
          },
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
