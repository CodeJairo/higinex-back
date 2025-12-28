import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { ValidatedUserPayload } from 'src/auth/interfaces/validated-user-payload.interface';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@Auth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(
    @CurrentUser('id') userId: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return await this.ordersService.createOrder(userId, createOrderDto);
  }

  @Get()
  async listOrders(
    @CurrentUser() user: ValidatedUserPayload,
    @Query() query: GetOrdersQueryDto,
  ) {
    return await this.ordersService.listOrders(user, query);
  }

  @Get(':orderId')
  async getOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: ValidatedUserPayload,
  ) {
    return await this.ordersService.getOrder(orderId, user);
  }

  @Post(':orderId/confirm-payment')
  @Auth('ADMIN')
  async confirmPayment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser('id') userId: string,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
  ) {
    return await this.ordersService.confirmPayment(
      orderId,
      userId,
      confirmPaymentDto,
    );
  }

  @Post(':orderId/cancel')
  @Auth('ADMIN')
  async cancelOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: ValidatedUserPayload,
    @Body() cancelOrderDto: CancelOrderDto,
  ) {
    return await this.ordersService.cancelOrder(orderId, user, cancelOrderDto);
  }

  @Post('expire-reservations')
  @Auth('ADMIN')
  async expireReservations(@CurrentUser('id') userId: string) {
    return await this.ordersService.expireReservations(userId);
  }
}
