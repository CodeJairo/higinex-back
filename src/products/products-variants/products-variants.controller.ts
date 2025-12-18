import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { ProductsVariantsService } from './products-variants.service';

@Controller('products/variants')
@Auth()
export class ProductVariantsController {
  constructor(
    private readonly productsVariantsService: ProductsVariantsService,
  ) {}

  @Post('/create/:id')
  @Auth('ADMIN')
  createProductVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createProductVariantDto: CreateProductVariantDto,
  ) {
    return this.productsVariantsService.createProductVariant(
      id,
      createProductVariantDto,
    );
  }

  @Get('/list/:id')
  async listProductVariants(@Param('id', ParseUUIDPipe) id: string) {
    return await this.productsVariantsService.listProductVariants(id);
  }
}
