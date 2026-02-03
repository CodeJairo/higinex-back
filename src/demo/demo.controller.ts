import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { DemoService } from './demo.service';
import {
  DemoLoginDto,
  NotifyDemoStatusDto,
  SendDemoInvoiceDto,
  CreateDemoOrderDto,
  UpdateDemoOrderStatusDto,
  CreateDemoAddressDto,
  UpdateDemoAddressDto,
  AdjustDemoInventoryDto,
  CreateDemoProductDto,
} from './dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { DEMO_INITIAL_DATA } from './demo.constants';

@Controller('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  /**
   * Quick login for demo mode (no password required)
   * Returns tokens and sets refresh cookie
   */
  @Post('login')
  @HttpCode(200)
  async demoLogin(
    @Body() dto: DemoLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.demoService.loginAsDemo(dto.type, dto.email, res);
  }

  /**
   * Returns the initial demo data to be loaded into sessionStorage
   * This includes products, contracts, customer info, inventory, etc.
   */
  @Get('initial-data')
  @HttpCode(200)
  getInitialData() {
    return this.demoService.getInitialDemoData();
  }

  /**
   * Generates an invoice PDF and sends it to the provided demo email
   * Does NOT persist anything to the database
   */
  @Post('send-invoice')
  @Auth()
  @HttpCode(200)
  async sendDemoInvoice(@Body() dto: SendDemoInvoiceDto) {
    return this.demoService.generateAndSendInvoice(dto);
  }

  /**
   * Sends an order status change notification to the demo email
   * Does NOT persist anything to the database
   */
  @Post('notify-status')
  @Auth()
  @HttpCode(200)
  async notifyStatusChange(@Body() dto: NotifyDemoStatusDto) {
    return this.demoService.sendStatusNotification(dto);
  }

  // ─── ADDRESSES ENDPOINTS ────────────────────────────────────────────────

  /**
   * Returns all demo addresses from the initial data
   */
  @Get('addresses')
  @Auth()
  @HttpCode(200)
  getAddresses() {
    return DEMO_INITIAL_DATA.customer.addresses;
  }

  /**
   * Simulates creating a new address (does NOT persist to database)
   * Returns the created address with a generated demo ID
   */
  @Post('addresses')
  @Auth()
  @HttpCode(201)
  createAddress(@Body() dto: CreateDemoAddressDto) {
    return this.demoService.createDemoAddress(dto);
  }

  /**
   * Simulates updating an address (does NOT persist to database)
   * Returns the echo of the updated body
   */
  @Patch('addresses/:id')
  @Auth()
  @HttpCode(200)
  updateAddress(@Param('id') id: string, @Body() dto: UpdateDemoAddressDto) {
    return this.demoService.updateDemoAddress(id, dto);
  }

  /**
   * Simulates deleting an address (does NOT persist to database)
   */
  @Delete('addresses/:id')
  @Auth()
  @HttpCode(200)
  deleteAddress(@Param('id') id: string) {
    return { ok: true, id };
  }

  // ─── ORDERS ENDPOINTS ───────────────────────────────────────────────────

  /**
   * Creates a demo order (does NOT persist to database)
   * Generates invoice PDF and sends it to the demo email if sendInvoice is true
   */
  @Post('orders')
  @Auth()
  @HttpCode(201)
  async createOrder(@Body() dto: CreateDemoOrderDto) {
    return this.demoService.createDemoOrder(dto);
  }

  /**
   * Returns an empty array (frontend handles orders in sessionStorage)
   */
  @Get('orders')
  @Auth()
  @HttpCode(200)
  getOrders() {
    return [];
  }

  /**
   * Individual order retrieval is handled on the client side
   */
  @Get('orders/:id')
  @Auth()
  @HttpCode(404)
  getOrder(@Param('id') id: string) {
    throw new NotFoundException(
      `Demo orders are managed in client sessionStorage. Order ID: ${id}`,
    );
  }

  /**
   * Changes order status and sends notification email to the demo email
   */
  @Post('orders/:id/status')
  @Auth()
  @HttpCode(200)
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDemoOrderStatusDto,
  ) {
    return this.demoService.updateDemoOrderStatus(id, dto);
  }

  // ─── INVENTORY ENDPOINTS (ADMIN ONLY) ──────────────────────────────────

  /**
   * Returns demo inventory data
   */
  @Get('inventory')
  @Auth(Role.ADMIN)
  @HttpCode(200)
  getInventory() {
    return DEMO_INITIAL_DATA.inventory;
  }

  /**
   * Simulates an inventory adjustment (does NOT persist to database)
   */
  @Post('inventory/adjust')
  @Auth(Role.ADMIN)
  @HttpCode(200)
  adjustInventory(@Body() dto: AdjustDemoInventoryDto) {
    return this.demoService.adjustDemoInventory(dto);
  }

  // ─── PRODUCTS ENDPOINTS ────────────────────────────────────────────────

  /**
   * Returns all demo products (public endpoint)
   */
  @Get('products')
  @HttpCode(200)
  getProducts() {
    return DEMO_INITIAL_DATA.products;
  }

  /**
   * Simulates creating a product (does NOT persist to database)
   */
  @Post('products')
  @Auth(Role.ADMIN)
  @HttpCode(201)
  createProduct(@Body() dto: CreateDemoProductDto) {
    return this.demoService.createDemoProduct(dto);
  }

  // ─── CONTRACTS ENDPOINTS ───────────────────────────────────────────────

  /**
   * Returns demo contracts (requires authentication)
   */
  @Get('contracts')
  @Auth()
  @HttpCode(200)
  getContracts() {
    return DEMO_INITIAL_DATA.contracts;
  }
}
