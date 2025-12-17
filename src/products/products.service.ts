import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { CreateProductDto } from './dto/create-product.dto';
import {
  GetAllProductQueryDto,
  ProductStatusParam,
} from './dto/get-all-product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(createProductDto: CreateProductDto) {
    try {
      this.logger.debug(`Product data: ${JSON.stringify(createProductDto)}`);
      const product = await this.prisma.product.create({
        data: createProductDto,
      });
      return product;
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ProductsService.createProduct',
        defaultMessage: 'Failed to create product',
      });
    }
  }

  async getAllProducts({
    status = ProductStatusParam.PUBLISHED,
    limit = 10,
    offset = 0,
  }: GetAllProductQueryDto) {
    try {
      return await this.prisma.product.findMany({
        where:
          status === ProductStatusParam.ALL
            ? undefined
            : {
                status:
                  status === ProductStatusParam.PUBLISHED
                    ? ProductStatus.PUBLISHED
                    : ProductStatus.ARCHIVED,
              },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ProductsService.getAllProducts',
        defaultMessage: 'Failed to retrieve products',
      });
    }
  }

  async setProductPublished(id: string) {
    try {
      await this.prisma.product.update({
        where: { id },
        data: {
          status: ProductStatus.PUBLISHED,
        },
      });
      return { message: 'Product set as published successfully' };
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ProductsService.setProductPublished',
        defaultMessage: 'Failed to set product as published',
      });
    }
  }

  async setProductArchived(id: string) {
    try {
      await this.prisma.product.update({
        where: { id },
        data: {
          status: ProductStatus.ARCHIVED,
        },
      });
      return { message: 'Product set as archived successfully ' };
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ProductsService.setProductArchived',
        defaultMessage: 'Failed to set product as archived',
      });
    }
  }

  async updateProduct(id: string, updateProductDto: UpdateProductDto) {
    try {
      await this.prisma.product.update({
        where: { id },
        data: updateProductDto,
      });
      return { message: 'Product updated successfully' };
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'ProductsService.updateProduct',
        defaultMessage: 'Failed to update product',
      });
    }
  }

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
        context: 'ProductsService.createProductVariant',
        defaultMessage: 'Failed to create product variant',
      });
    }
  }
}
