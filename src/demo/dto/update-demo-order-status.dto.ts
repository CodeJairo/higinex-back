import { IsEmail, IsEnum, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateDemoOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsEmail()
  customerEmail: string;

  @IsString()
  customerName: string;

  @IsString()
  orderNumber: string;
}
