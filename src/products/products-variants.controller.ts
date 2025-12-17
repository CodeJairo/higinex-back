import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { ProductsService } from './products.service';

@Controller('products/variants')
@Auth()
export class ProductVariantsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('/create/:id')
  @Auth('ADMIN')
  createProductVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createProductVariantDto: CreateProductVariantDto,
  ) {
    return this.productsService.createProductVariant(
      id,
      createProductVariantDto,
    );
  }
}
