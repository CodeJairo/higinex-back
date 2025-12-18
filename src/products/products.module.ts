import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProductVariantsController } from './products-variants/products-variants.controller';
import { ProductsVariantsService } from './products-variants/products-variants.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController, ProductVariantsController],
  providers: [ProductsService, ProductsVariantsService],
})
export class ProductsModule {}
