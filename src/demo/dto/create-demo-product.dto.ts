import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from 'src/common/decorators/transforms.decorator';

class DemoProductVariantDto {
  @IsString()
  sku: string;

  @IsString()
  name: string;
}

export class CreateDemoProductDto {
  @IsString()
  @Trim()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @Trim({ emptyToUndefined: true })
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DemoProductVariantDto)
  variants?: DemoProductVariantDto[];
}
