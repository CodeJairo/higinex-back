import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProductVariantDto } from '../products-variants/dto/create-product-variant.dto';

export class UpdateProductVariantDto extends PartialType(
  OmitType(CreateProductVariantDto, ['initialOnHand'] as const),
) {}
