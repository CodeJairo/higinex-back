import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

@Injectable()
export class ProductsVariantsService {
  private readonly logger = new Logger(ProductsVariantsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async createProductVariant(
    productId: string,
    createProductVariantDto: CreateProductVariantDto,
  ) {
    try {
      const { sku, gtin, name, attributesJson, initialOnHand } =
        createProductVariantDto;

      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: productId, deletedAt: null },
          select: { id: true },
        });

        if (!product) throw new NotFoundException('Product not found');

        const variant = await tx.productVariant.create({
          data: {
            productId,
            sku,
            gtin,
            name,
            attributesJson,
          },
        });

        await tx.inventoryBalance.create({
          data: {
            variantId: variant.id,
            onHand: 0,
          },
        });

        if (typeof initialOnHand === 'number' && initialOnHand > 0) {
          await tx.inventoryMovement.create({
            data: {
              variantId: variant.id,
              type: 'IN',
              quantity: initialOnHand,
              reason: 'Initial stock',
            },
          });

          await tx.inventoryBalance.update({
            where: { variantId: variant.id },
            data: {
              onHand: { increment: initialOnHand },
            },
          });
        }

        return await tx.productVariant.findUnique({
          where: { id: variant.id },
          include: { inventory: true },
        });
      });
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ProductsVariantsService.createProductVariant',
        defaultMessage: 'Failed to create product variant',
      });
    }
  }

  async getProductVariant(variantId: string) {
    try {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: variantId, deletedAt: null },
        select: {
          id: true,
          productId: true,
          sku: true,
          gtin: true,
          name: true,
          attributesJson: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          images: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              altText: true,
              sortOrder: true,
              createdAt: true,
              mimeType: true,
              filename: true,
            },
          },
          inventory: {
            select: { onHand: true, reserved: true, updatedAt: true },
          },
        },
      });

      if (!variant) throw new NotFoundException('Variant not found');

      return variant;
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ProductsVariantsService.getProductVariant',
        defaultMessage: 'Failed to get product variant',
      });
    }
  }

  async updateProductVariant(variantId: string, dto: UpdateProductVariantDto) {
    try {
      const updated = await this.prisma.productVariant.updateMany({
        where: { id: variantId, deletedAt: null },
        data: dto,
      });

      if (updated.count === 0) throw new NotFoundException('Variant not found');

      return { message: 'Variant updated successfully' };
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ProductsVariantsService.updateProductVariant',
        defaultMessage: 'Failed to update product variant',
      });
    }
  }

  async setVariantActive(variantId: string, isActive: boolean) {
    try {
      const updated = await this.prisma.productVariant.updateMany({
        where: { id: variantId, deletedAt: null },
        data: { isActive },
      });

      if (updated.count === 0) throw new NotFoundException('Variant not found');

      return {
        message: isActive
          ? 'Variant activated successfully'
          : 'Variant deactivated successfully',
      };
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ProductsVariantsService.setVariantActive',
        defaultMessage: 'Failed to update variant status',
      });
    }
  }

  async deleteProductVariant(variantId: string) {
    try {
      const updated = await this.prisma.productVariant.updateMany({
        where: { id: variantId, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });

      if (updated.count === 0) throw new NotFoundException('Variant not found');

      return { message: 'Variant deleted successfully' };
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ProductsVariantsService.deleteProductVariant',
        defaultMessage: 'Failed to delete product variant',
      });
    }
  }
}
