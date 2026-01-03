import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'fs';
import path from 'path';
import { ORDER_STATUS_LABELS } from './constants/email.constants';
import {
  AuthCodeEmailInput,
  EmailPayload,
  EmailVerificationLinkInput,
  OrderEmailContext,
  OrderNotificationInput,
} from './interfaces/email.types';
import { InvoiceService } from './invoice/invoice.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly companyOrdersEmail: string | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
    private readonly invoiceService: InvoiceService,
  ) {
    this.companyOrdersEmail =
      this.configService.get<string>('COMPANY_ORDERS_EMAIL') ?? null;
  }

  async sendOrderCreatedToCompany(input: OrderNotificationInput) {
    if (!this.companyOrdersEmail) {
      this.logger.warn('COMPANY_ORDERS_EMAIL is not configured');
      return;
    }

    const { context, subject } = this.buildOrderContext(
      input,
      `Nuevo pedido ${input.orderNumber}`,
    );

    // Ensure customer is fully available in context for the template
    const companyContext = {
      ...context,
      customer: input.customer,
    };

    await this.sendMail({
      to: this.companyOrdersEmail,
      subject,
      template: './order-created-company',
      context: companyContext,
    });
  }

  async sendOrderCreatedToCustomer(input: OrderNotificationInput) {
    const { context, subject } = this.buildOrderContext(
      input,
      `Pedido recibido ${input.orderNumber}`,
    );

    let attachments: any[] = [];
    try {
      const invoiceBuffer = await this.invoiceService.generateInvoice(context);
      attachments = [
        {
          filename: `Factura-${input.orderNumber}.pdf`,
          content: invoiceBuffer,
          contentType: 'application/pdf',
        },
      ];
    } catch (error) {
      this.logger.error(
        `Failed to generate invoice for order ${input.orderNumber}`,
        error,
      );
      // Continue without invoice if generation fails
    }

    await this.sendMail(
      {
        to: input.customer.email,
        subject,
        template: './order-created-customer',
        context,
      },
      attachments,
    );
  }

  async sendOrderStatusChangedToCustomer(input: OrderNotificationInput) {
    const { context, subject } = this.buildOrderContext(
      input,
      `Actualización de pedido ${input.orderNumber}`,
    );

    await this.sendMail({
      to: input.customer.email,
      subject,
      template: './order-status-changed',
      context,
    });
  }

  async sendEmailVerificationLink(input: EmailVerificationLinkInput) {
    await this.sendMail({
      to: input.email,
      subject: 'Verifica tu correo',
      template: './email-verification',
      context: {
        link: input.link,
        expiresInMinutes: input.expiresInMinutes,
      },
    });
  }

  async sendPasswordResetCode(input: AuthCodeEmailInput) {
    await this.sendMail({
      to: input.email,
      subject: 'Código para restablecer tu contraseña',
      template: './password-reset',
      context: {
        code: input.code,
        expiresInMinutes: input.expiresInMinutes,
      },
    });
  }

  private async sendMail(payload: EmailPayload, attachments: any[] = []) {
    try {
      const logoAttachment = this.getLogoAttachment();
      const allAttachments = logoAttachment
        ? [...attachments, logoAttachment]
        : attachments;

      const contextWithLogo = {
        ...payload.context,
        logoUrl: logoAttachment ? 'cid:logo' : '',
        year: new Date().getFullYear(),
      };

      await this.mailerService.sendMail({
        to: payload.to,
        subject: payload.subject,
        template: payload.template,
        context: contextWithLogo,
        attachments: allAttachments,
      });
      this.logger.log(`Email sent to ${payload.to} [${payload.subject}]`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${payload.to}`,
        error as Error,
      );
    }
  }

  private getLogoAttachment(): any | null {
    try {
      const logoPath = path.join(__dirname, 'assets', 'logo.png');
      if (fs.existsSync(logoPath)) {
        return {
          filename: 'logo.png',
          path: logoPath,
          cid: 'logo',
        };
      }
      return null;
    } catch (error) {
      this.logger.error('Failed to prepare logo attachment', error);
      return null;
    }
  }

  /**
   * Centralized logic to prepare data for order templates.
   * Handles formatting, totals, and status labels.
   */
  private buildOrderContext(
    input: OrderNotificationInput,
    subject: string,
  ): { context: OrderEmailContext; subject: string } {
    const currency = input.currency ?? 'COP';

    // Format Items
    const items = input.items.map((item) => ({
      displayName: this.formatItemName(item.productName, item.variantName),
      quantity: item.quantity,
      unitPriceFormatted: this.formatCurrency(item.unitPrice, currency),
      lineTotalFormatted: this.formatCurrency(item.lineTotal, currency),
      lineTotalValue: this.toNumber(item.lineTotal) ?? 0,
    }));

    // Calculate Totals if not provided
    const computedSubtotal = items.reduce(
      (sum, item) => sum + item.lineTotalValue,
      0,
    );
    const subtotalValue =
      this.toNumber(input.subtotalAmount) ?? computedSubtotal;
    const taxesValue = this.toNumber(input.taxesAmount) ?? 0;
    const shippingValue = this.toNumber(input.shippingAmount) ?? 0;
    const discountValue = this.toNumber(input.discountAmount) ?? 0;
    const totalValue =
      this.toNumber(input.totalAmount) ??
      subtotalValue + taxesValue + shippingValue - discountValue;

    // Use OrderEmailContext structure
    const context: OrderEmailContext = {
      ...input, // Contains basic order info (orderNumber, etc.)
      customerName: input.customer.name,
      createdAtLabel: this.formatDate(input.createdAt),
      statusLabel: this.getStatusLabel(input.status),
      items,
      subtotalFormatted: this.formatCurrency(subtotalValue, currency),
      taxesFormatted: this.formatCurrency(taxesValue, currency),
      shippingFormatted: this.formatCurrency(shippingValue, currency),
      discountFormatted: this.formatCurrency(discountValue, currency),
      totalFormatted: this.formatCurrency(totalValue, currency),
    };

    return { context, subject };
  }

  // --- Helpers ---

  private formatCurrency(value: number | string, currency: string): string {
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(numeric)) return String(value);

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numeric);
  }

  private formatDate(date: Date): string {
    try {
      return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return String(date);
    }
  }

  private getStatusLabel(status?: string): string {
    if (!status) return 'En proceso';
    return ORDER_STATUS_LABELS[status] ?? status; // Returns original status if not found in map
  }

  private formatItemName(productName: string, variantName?: string): string {
    if (!variantName || variantName.trim().length === 0) {
      return productName;
    }
    return `${productName} - ${variantName}`;
  }

  private toNumber(value: number | string | undefined | null): number | null {
    if (value === undefined || value === null) return null;
    const numeric = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(numeric) ? numeric : null;
  }
}
