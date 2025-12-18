import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProductVariantImagesController } from './products-variants-images/products-variant-images.controller';
import { ProductVariantImagesService } from './products-variants-images/products-variant-images.service';
import { ProductVariantsController } from './products-variants/products-variants.controller';
import { ProductsVariantsService } from './products-variants/products-variants.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ProductsController,
    ProductVariantsController,
    ProductVariantImagesController,
  ],
  providers: [
    ProductsService,
    ProductsVariantsService,
    ProductVariantImagesService,
  ],
})
export class ProductsModule {}
