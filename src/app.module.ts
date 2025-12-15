import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { ConfigModule } from '@nestjs/config';
import { envConfigSchema } from './config/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envConfigSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    PrismaModule,
    AuthModule,
    SeedModule,
  ],
})
export class AppModule {}
