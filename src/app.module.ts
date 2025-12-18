import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { ConfigModule } from '@nestjs/config';
import { envConfigSchema } from './config/env.schema';
import { ProductsModule } from './products/products.module';
import { PricingModule } from './pricing/pricing.module';

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
    ProductsModule,
    PricingModule,
  ],
})
export class AppModule {}
