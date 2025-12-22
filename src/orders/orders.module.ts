import { Module } from '@nestjs/common';
import { InventoryModule } from 'src/inventory/inventory.module';
import { PricingModule } from 'src/pricing/pricing.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [PrismaModule, InventoryModule, PricingModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
