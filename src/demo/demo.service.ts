import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import sgMail from '@sendgrid/mail';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from '../notifications/invoice/invoice.service';
import { DEMO_ACCOUNTS, DEMO_INITIAL_DATA } from './demo.constants';
import {
  SendDemoInvoiceDto,
  NotifyDemoStatusDto,
  CreateDemoOrderDto,
  UpdateDemoOrderStatusDto,
  CreateDemoAddressDto,
  UpdateDemoAddressDto,
  AdjustDemoInventoryDto,
  CreateDemoProductDto,
} from './dto';

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private readonly templatesDir: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {
    this.templatesDir = path.join(
      process.cwd(),
      'dist',
      'notifications',
      'templates',
    );

    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }
  }

  /**
   * Login as a demo user (admin or cliente)
   * Returns tokens and sets refresh cookie
   */
  async loginAsDemo(type: 'admin' | 'user', demoEmail: string, res: Response) {
    const accountEmail = DEMO_ACCOUNTS[type];

    const user = await this.prisma.user.findUnique({
      where: { email: accountEmail },
      include: { customer: true },
    });

    if (!user) {
      throw new NotFoundException(
        `Demo account not configured. Please run seed with SEED_DEMO=true`,
      );
    }

    // Issue tokens
    const accessToken = await this.getAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = await this.getRefreshToken(user.id);

    // Set refresh token cookie
    this.setRefreshCookie(res, refreshToken);

    this.logger.log(`Demo login: ${type} (notifications to: ${demoEmail})`);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      customer: user.customer || undefined,
      accessToken,
      demoEmail,
      isDemo: true,
    };
  }

  /**
   * Returns the initial demo data to be loaded into sessionStorage
   */
  getInitialDemoData() {
    return DEMO_INITIAL_DATA;
  }

  /**
   * Generates an invoice PDF and sends it to the demo email
   * Does NOT persist anything to the database
   */
  async generateAndSendInvoice(dto: SendDemoInvoiceDto) {
    const { demoEmail, order } = dto;

    // Build context for invoice generation (simplified for demo)
    const currency = 'COP';
    const items = order.items.map((item) => ({
      displayName: item.name,
      quantity: item.quantity,
      unitPriceFormatted: this.formatCurrency(item.unitPrice, currency),
      lineTotalFormatted: this.formatCurrency(item.total, currency),
      lineTotalValue: item.total,
    }));

    const invoiceContext = {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      createdAtLabel: this.formatDate(new Date()),
      statusLabel: 'Pendiente de pago',
      items,
      subtotalFormatted: this.formatCurrency(order.subtotal, currency),
      taxesFormatted: this.formatCurrency(order.tax || 0, currency),
      shippingFormatted: this.formatCurrency(0, currency),
      discountFormatted: this.formatCurrency(0, currency),
      totalFormatted: this.formatCurrency(order.total, currency),
      shippingAddress: order.shippingAddress || 'Dirección de envío demo',
      logoUrl: '',
      year: new Date().getFullYear(),
      isDemo: true,
    };

    try {
      // Generate PDF invoice using the simplified context
      const invoiceBuffer = await this.invoiceService.generateInvoice(
        invoiceContext as any,
      );

      // Send email with invoice attached
      await this.sendDemoEmail({
        to: demoEmail,
        subject: `[DEMO] Factura - Pedido #${order.orderNumber}`,
        template: 'order-created-customer',
        context: invoiceContext,
        attachments: [
          {
            content: invoiceBuffer.toString('base64'),
            filename: `Factura-${order.orderNumber}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment' as const,
          },
        ],
      });

      this.logger.log(
        `Demo invoice sent to ${demoEmail} for order ${order.orderNumber}`,
      );

      return { success: true, message: 'Invoice sent to demo email' };
    } catch (error) {
      this.logger.error(`Failed to send demo invoice: ${error}`);
      throw error;
    }
  }

  /**
   * Sends a status change notification to the demo email
   */
  async sendStatusNotification(dto: NotifyDemoStatusDto) {
    const { demoEmail, orderNumber, oldStatus, newStatus } = dto;

    const statusLabels: Record<string, string> = {
      PENDING_PAYMENT: 'Pendiente de pago',
      PAID: 'Pagado',
      PREPARING: 'En preparación',
      SHIPPED: 'Enviado',
      DELIVERED: 'Entregado',
      CANCELED: 'Cancelado',
    };

    await this.sendDemoEmail({
      to: demoEmail,
      subject: `[DEMO] Actualización de pedido #${orderNumber}`,
      template: 'order-status-changed',
      context: {
        orderNumber,
        oldStatusLabel: statusLabels[oldStatus] || oldStatus,
        statusLabel: statusLabels[newStatus] || newStatus,
        customerName: 'Cliente Demo',
        createdAtLabel: this.formatDate(new Date()),
        logoUrl: '',
        year: new Date().getFullYear(),
        isDemo: true,
      },
    });

    this.logger.log(`Demo status notification sent to ${demoEmail}`);

    return { success: true };
  }

  // ─── ADDRESSES METHODS ──────────────────────────────────────────────────

  /**
   * Creates a demo address (does NOT persist to database)
   * Returns the address object with a generated demo ID
   */
  createDemoAddress(dto: CreateDemoAddressDto) {
    const id = `demo-addr-${randomUUID()}`;

    this.logger.log(`Demo address created with ID: ${id}`);

    return {
      id,
      ...dto,
      isDefault: dto.isDefault ?? false,
    };
  }

  /**
   * Updates a demo address (does NOT persist to database)
   * Returns the echo of the updated body with the ID
   */
  updateDemoAddress(id: string, dto: UpdateDemoAddressDto) {
    this.logger.log(`Demo address updated with ID: ${id}`);

    return {
      id,
      ...dto,
    };
  }

  // ─── ORDERS METHODS ─────────────────────────────────────────────────────

  /**
   * Creates a demo order (does NOT persist to database)
   * Generates invoice PDF and sends it to the demo email if sendInvoice is true
   */
  async createDemoOrder(dto: CreateDemoOrderDto) {
    const orderId = `demo-order-${randomUUID()}`;
    const timestamp = Date.now();
    const orderNumber = `DEMO-${timestamp}`;

    const order = {
      id: orderId,
      orderNumber,
      status: 'PENDING_PAYMENT',
      items: dto.items,
      subtotalAmount: dto.subtotalAmount,
      totalAmount: dto.totalAmount,
      shippingAddressId: dto.shippingAddressId,
      shippingAddress: dto.shippingAddress,
      customerNotes: dto.customerNotes,
      customerName: dto.customerName || 'Cliente Demo',
      createdAt: new Date().toISOString(),
      isDemo: true,
    };

    this.logger.log(`Demo order created with ID: ${orderId}`);

    // Send invoice if requested
    if (dto.sendInvoice !== false) {
      try {
        await this.generateAndSendInvoice({
          demoEmail: dto.demoEmail,
          order: {
            orderNumber,
            customerName: order.customerName,
            items: dto.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
            subtotal: dto.subtotalAmount,
            total: dto.totalAmount,
            shippingAddress: dto.shippingAddress,
          },
        });
      } catch (error) {
        this.logger.warn(`Failed to send invoice for demo order: ${error}`);
        // Don't fail the order creation if email fails
      }
    }

    return order;
  }

  /**
   * Updates a demo order status and sends notification email
   */
  async updateDemoOrderStatus(orderId: string, dto: UpdateDemoOrderStatusDto) {
    const statusLabels: Record<string, string> = {
      PENDING_PAYMENT: 'Pendiente de pago',
      PAID: 'Pagado',
      PREPARING: 'En preparación',
      SHIPPED: 'Enviado',
      DELIVERED: 'Entregado',
      CANCELED: 'Cancelado',
      RETURN_REQUESTED: 'Devolución solicitada',
      RETURNED: 'Devuelto',
      REFUNDED: 'Reembolsado',
    };

    try {
      await this.sendDemoEmail({
        to: dto.customerEmail,
        subject: `[DEMO] Actualización de pedido #${dto.orderNumber}`,
        template: 'order-status-changed',
        context: {
          orderNumber: dto.orderNumber,
          statusLabel: statusLabels[dto.status] || dto.status,
          customerName: dto.customerName,
          createdAtLabel: this.formatDate(new Date()),
          logoUrl: '',
          year: new Date().getFullYear(),
          isDemo: true,
        },
      });

      this.logger.log(`Demo order status updated: ${orderId} -> ${dto.status}`);
    } catch (error) {
      this.logger.warn(`Failed to send status notification: ${error}`);
    }

    return {
      ok: true,
      orderId,
      status: dto.status,
      statusLabel: statusLabels[dto.status] || dto.status,
    };
  }

  // ─── INVENTORY METHODS ──────────────────────────────────────────────────

  /**
   * Simulates an inventory adjustment (does NOT persist to database)
   */
  adjustDemoInventory(dto: AdjustDemoInventoryDto) {
    this.logger.log(
      `Demo inventory adjusted: ${dto.variantId} by ${dto.quantity}`,
    );

    return {
      ok: true,
      message: `Inventory adjusted by ${dto.quantity} units for variant ${dto.variantId}`,
      adjustment: {
        id: `demo-adjustment-${randomUUID()}`,
        variantId: dto.variantId,
        quantity: dto.quantity,
        reason: dto.reason,
        notes: dto.notes,
        createdAt: new Date().toISOString(),
      },
    };
  }

  // ─── PRODUCTS METHODS ───────────────────────────────────────────────────

  /**
   * Simulates creating a product (does NOT persist to database)
   */
  createDemoProduct(dto: CreateDemoProductDto) {
    const productId = `demo-prod-${randomUUID()}`;
    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const variants = (dto.variants || []).map((v) => ({
      id: `demo-var-${randomUUID()}`,
      sku: v.sku,
      name: v.name,
      isActive: true,
    }));

    this.logger.log(`Demo product created with ID: ${productId}`);

    return {
      id: productId,
      name: dto.name,
      slug,
      description: dto.description,
      status: 'PUBLISHED',
      variants,
      images: [],
      createdAt: new Date().toISOString(),
      isDemo: true,
    };
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────

  private async getAccessToken(payload: {
    id: string;
    email: string;
    role: Role;
  }) {
    return this.jwtService.signAsync(payload);
  }

  private async getRefreshToken(userId: string) {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');

    return this.jwtService.signAsync(
      { sub: userId, tokenType: 'refresh', jti: randomUUID() },
      { secret, expiresIn: expiresIn as any },
    );
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    const cookieName = this.configService.get<string>(
      'AUTH_REFRESH_COOKIE_NAME',
    )!;
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>(
      'AUTH_COOKIE_SAMESITE',
    );
    const secure =
      this.configService.get<boolean>('AUTH_COOKIE_SECURE', false) ||
      this.configService.get<string>('NODE_ENV') === 'production';

    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')!;
    const maxAge = this.parseDuration(expiresIn);

    res.cookie(cookieName, refreshToken, {
      httpOnly: true,
      sameSite,
      secure,
      maxAge,
      path: '/',
    });
  }

  private parseDuration(duration: string): number {
    if (!isNaN(Number(duration))) return Number(duration);

    const match = duration.match(/^(\d+)([dhms])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      case 's':
        return value * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  private async sendDemoEmail(payload: {
    to: string;
    subject: string;
    template: string;
    context: Record<string, any>;
    attachments?: Array<{
      content: string;
      filename: string;
      type: string;
      disposition: 'attachment' | 'inline';
    }>;
  }) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const emailFrom = this.configService.get<string>('EMAIL_FROM') || '';

    if (!apiKey) {
      this.logger.warn('SENDGRID_API_KEY not configured, skipping demo email');
      return;
    }

    const templatePath = path.join(
      this.templatesDir,
      `${payload.template}.hbs`,
    );

    let htmlContent = `<h1>[DEMO] ${payload.subject}</h1><p>Este es un correo de demostración.</p>`;

    if (fs.existsSync(templatePath)) {
      const templateSource = fs.readFileSync(templatePath, 'utf-8');
      const compiledTemplate = Handlebars.compile(templateSource);
      htmlContent = compiledTemplate(payload.context);
    }

    const msg: sgMail.MailDataRequired = {
      to: payload.to,
      from: emailFrom,
      subject: payload.subject,
      html: htmlContent,
      attachments: payload.attachments,
    };

    await sgMail.send(msg);
  }

  private formatCurrency(value: number, currency: string): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date);
  }
}
