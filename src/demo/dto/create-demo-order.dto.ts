import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from 'src/common/decorators/transforms.decorator';

class DemoOrderItemDto {
  @IsString()
  variantId: string;

  @IsString()
  name: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  total: number;
}

export class CreateDemoOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DemoOrderItemDto)
  items: DemoOrderItemDto[];

  @IsOptional()
  @IsString()
  shippingAddressId?: string;

  @IsOptional()
  @IsString()
  @Trim({ emptyToUndefined: true })
  @MaxLength(1000)
  customerNotes?: string;

  @IsNumber()
  subtotalAmount: number;

  @IsNumber()
  totalAmount: number;

  @IsEmail()
  demoEmail: string;

  @IsOptional()
  @IsBoolean()
  sendInvoice?: boolean;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  shippingAddress?: string;
}
