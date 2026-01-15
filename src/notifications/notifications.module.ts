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
      useFactory: (configService: ConfigService) => ({
        transport: {
          // 1. Usar el servicio predefinido de Gmail es 100% más fiable en prod
          service: 'gmail',
          auth: {
            user: cleanEnv(configService.get<string>('SMTP_USER')),
            pass: cleanEnv(configService.get<string>('SMTP_PASS')),
          },
          // 2. Mantén tus configuraciones de optimización
          pool: true,
          maxConnections: 1,
          rateLimit: 2,

          // 3. CONFIGURACIÓN CRÍTICA PARA RENDER
          tls: {
            // Esto evita que la conexión falle si hay un salto de red
            // o un proxy intermedio en Render que Gmail no reconoce.
            rejectUnauthorized: false,
            // Fuerza a usar IPv4 (Gmail a veces ignora peticiones IPv6 de datacenters)
            servername: 'smtp.gmail.com',
          },
          connectionTimeout: 20000, // Más tiempo para el handshake inicial
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
      }),
    }),
  ],
  providers: [NotificationsService, InvoiceService],
  exports: [NotificationsService, InvoiceService],
})
export class NotificationsModule {}
