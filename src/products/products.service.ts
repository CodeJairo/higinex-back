import { Injectable, Logger } from '@nestjs/common';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

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
}
