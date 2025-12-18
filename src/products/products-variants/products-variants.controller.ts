import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { ProductsVariantsService } from './products-variants.service';

@Controller('products/variants')
@Auth()
export class ProductVariantsController {
  constructor(
    private readonly productsVariantsService: ProductsVariantsService,
  ) {}

  @Post('/create/:productId')
  @Auth('ADMIN')
  async createProductVariant(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() createProductVariantDto: CreateProductVariantDto,
  ) {
    return await this.productsVariantsService.createProductVariant(
      productId,
      createProductVariantDto,
    );
  }

  @Get(':variantId')
  async getVariant(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return await this.productsVariantsService.getProductVariant(variantId);
  }

  @Patch('update/:variantId')
  @Auth('ADMIN')
  async updateVariant(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return await this.productsVariantsService.updateProductVariant(
      variantId,
      dto,
    );
  }

  @Patch('activate/:variantId')
  @Auth('ADMIN')
  async activate(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return await this.productsVariantsService.setVariantActive(variantId, true);
  }

  @Patch('deactivate/:variantId')
  @Auth('ADMIN')
  async deactivate(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return await this.productsVariantsService.setVariantActive(
      variantId,
      false,
    );
  }

  @Delete(':variantId')
  @Auth('ADMIN')
  async remove(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return await this.productsVariantsService.deleteProductVariant(variantId);
  }
}
