import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { envConfigSchema } from './config/env.schema';
import { CustomersModule } from './customers/customers.module';
import { InventoryModule } from './inventory/inventory.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PricingModule } from './pricing/pricing.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SeedModule } from './seed/seed.module';
import { UsersModule } from './users/users.module';
import { FinanceModule } from './finance/finance.module';

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
    InventoryModule,
    OrdersModule,
    NotificationsModule,
    CustomersModule,
    UsersModule,
    AnalyticsModule,
    FinanceModule,
  ],
})
export class AppModule { }
