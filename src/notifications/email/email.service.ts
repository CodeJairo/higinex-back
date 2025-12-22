import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string | null;
  private readonly companyOrdersEmail: string | null;

  constructor(private readonly configService: ConfigService) {
    const config = this.loadConfig();
    this.fromAddress = config.fromAddress;
    this.companyOrdersEmail = config.companyOrdersEmail;
    this.transporter = config.enabled
      ? nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpPort === 465,
          auth: {
            user: config.smtpUser,
            pass: config.smtpPass,
          },
        })
      : null;
  }

  async sendOrderCreatedToCompany(input: OrderNotificationInput) {
    if (!this.companyOrdersEmail) {
      this.logger.warn('COMPANY_ORDERS_EMAIL is not configured');
      return;
    }

    const subject = `New order ${input.orderNumber}`;
    const content = this.renderOrderEmail({
      ...input,
      includeCustomer: true,
      includeNotes: true,
      includeStatus: true,
    });

    await this.sendMail({
      to: this.companyOrdersEmail,
      subject,
      text: content.text,
      html: content.html,
    });
  }

  async sendOrderCreatedToCustomer(input: OrderNotificationInput) {
    const subject = `Order received ${input.orderNumber}`;
    const content = this.renderOrderEmail({
      ...input,
      includeCustomer: false,
      includeNotes: true,
      includeStatus: true,
    });

    await this.sendMail({
      to: input.customer.email,
      subject,
      text: content.text,
      html: content.html,
    });
  }

  async sendOrderStatusChangedToCustomer(input: OrderNotificationInput) {
    const subject = `Order update ${input.orderNumber}`;
    const content = this.renderOrderEmail({
      ...input,
      includeCustomer: false,
      includeNotes: false,
      includeStatus: true,
    });

    await this.sendMail({
      to: input.customer.email,
      subject,
      text: content.text,
      html: content.html,
    });
  }

  private async sendMail(payload: EmailPayload) {
    if (!this.transporter) {
      this.logger.warn('Email transport is not configured');
      return;
    }

    if (!this.fromAddress) {
      this.logger.warn('EMAIL_FROM is not configured');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
    } catch (error) {
      this.logger.error('Failed to send email', error as Error);
    }
  }

  private renderOrderEmail(input: OrderRenderInput) {
    const createdAt = this.formatDate(input.createdAt);
    const totalAmount = this.formatCurrency(
      input.totalAmount,
      input.currency ?? 'COP',
    );
    const items = input.items.map((item) => ({
      ...item,
      unitPriceFormatted: this.formatCurrency(
        item.unitPrice,
        input.currency ?? 'COP',
      ),
      lineTotalFormatted: this.formatCurrency(
        item.lineTotal,
        input.currency ?? 'COP',
      ),
    }));

    const statusLine = input.includeStatus && input.status ? input.status : '';
    const notesLine = input.includeNotes ? (input.customerNotes ?? '') : '';

    const text = [
      `Order: ${input.orderNumber}`,
      `Date: ${createdAt}`,
      statusLine ? `Status: ${statusLine}` : '',
      '',
      'Items:',
      ...items.map(
        (item) =>
          `- ${item.productName} / ${item.variantName ?? ''} x${
            item.quantity
          } = ${item.lineTotalFormatted}`,
      ),
      '',
      `Total: ${totalAmount}`,
      notesLine ? `Notes: ${notesLine}` : '',
      input.includeCustomer
        ? [
            '',
            'Customer:',
            `Name: ${input.customer.name}`,
            `Email: ${input.customer.email}`,
            input.customer.phone ? `Phone: ${input.customer.phone}` : '',
            input.customer.documentType && input.customer.documentNumber
              ? `Document: ${input.customer.documentType} ${input.customer.documentNumber}`
              : '',
          ]
            .filter(Boolean)
            .join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111;">
        <h2>Order ${this.escapeHtml(input.orderNumber)}</h2>
        <p><strong>Date:</strong> ${this.escapeHtml(createdAt)}</p>
        ${
          statusLine
            ? `<p><strong>Status:</strong> ${this.escapeHtml(statusLine)}</p>`
            : ''
        }
        <h3>Items</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; border-bottom: 1px solid #ddd; padding: 6px;">Item</th>
              <th style="text-align: right; border-bottom: 1px solid #ddd; padding: 6px;">Qty</th>
              <th style="text-align: right; border-bottom: 1px solid #ddd; padding: 6px;">Unit</th>
              <th style="text-align: right; border-bottom: 1px solid #ddd; padding: 6px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
              <tr>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">
                  ${this.escapeHtml(item.productName)}
                  ${
                    item.variantName
                      ? `<div style="color: #666;">${this.escapeHtml(
                          item.variantName,
                        )}</div>`
                      : ''
                  }
                </td>
                <td style="text-align: right; padding: 6px; border-bottom: 1px solid #eee;">${
                  item.quantity
                }</td>
                <td style="text-align: right; padding: 6px; border-bottom: 1px solid #eee;">${
                  item.unitPriceFormatted
                }</td>
                <td style="text-align: right; padding: 6px; border-bottom: 1px solid #eee;">${
                  item.lineTotalFormatted
                }</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
        <p><strong>Total:</strong> ${this.escapeHtml(totalAmount)}</p>
        ${
          notesLine
            ? `<p><strong>Notes:</strong> ${this.escapeHtml(notesLine)}</p>`
            : ''
        }
        ${
          input.includeCustomer
            ? `
        <h3>Customer</h3>
        <p><strong>Name:</strong> ${this.escapeHtml(input.customer.name)}</p>
        <p><strong>Email:</strong> ${this.escapeHtml(input.customer.email)}</p>
        ${
          input.customer.phone
            ? `<p><strong>Phone:</strong> ${this.escapeHtml(
                input.customer.phone,
              )}</p>`
            : ''
        }
        ${
          input.customer.documentType && input.customer.documentNumber
            ? `<p><strong>Document:</strong> ${this.escapeHtml(
                `${input.customer.documentType} ${input.customer.documentNumber}`,
              )}</p>`
            : ''
        }
        `
            : ''
        }
      </div>
    `.trim();

    return { text, html };
  }

  private formatCurrency(value: number | string, currency: string) {
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(numeric)) return String(value);

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(numeric);
  }

  private formatDate(date: Date) {
    try {
      return date.toISOString();
    } catch {
      return String(date);
    }
  }

  private escapeHtml(input: string) {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private loadConfig() {
    const provider =
      this.configService.get<string>('EMAIL_PROVIDER') ?? 'DISABLED';
    const fromAddress = this.configService.get<string>('EMAIL_FROM') ?? null;
    const companyOrdersEmail =
      this.configService.get<string>('COMPANY_ORDERS_EMAIL') ?? null;
    const smtpHost = this.configService.get<string>('SMTP_HOST') ?? null;
    const smtpPort = this.configService.get<number>('SMTP_PORT') ?? null;
    const smtpUser = this.configService.get<string>('SMTP_USER') ?? null;
    const smtpPass = this.configService.get<string>('SMTP_PASS') ?? null;

    const missing: string[] = [];

    if (!fromAddress) missing.push('EMAIL_FROM');
    if (!companyOrdersEmail) missing.push('COMPANY_ORDERS_EMAIL');

    if (provider === 'SMTP') {
      if (!smtpHost) missing.push('SMTP_HOST');
      if (!smtpPort || Number.isNaN(smtpPort)) missing.push('SMTP_PORT');
      if (!smtpUser) missing.push('SMTP_USER');
      if (!smtpPass) missing.push('SMTP_PASS');
    }

    if (missing.length > 0) {
      this.logger.warn(`Email disabled. Missing: ${missing.join(', ')}`);
      return {
        enabled: false,
        fromAddress,
        companyOrdersEmail,
        smtpHost: smtpHost ?? '',
        smtpPort: smtpPort ?? 465,
        smtpUser: smtpUser ?? '',
        smtpPass: smtpPass ?? '',
      };
    }

    if (provider !== 'SMTP') {
      this.logger.warn('Email disabled. EMAIL_PROVIDER is not SMTP.');
      return {
        enabled: false,
        fromAddress,
        companyOrdersEmail,
        smtpHost: smtpHost ?? '',
        smtpPort: smtpPort ?? 465,
        smtpUser: smtpUser ?? '',
        smtpPass: smtpPass ?? '',
      };
    }

    return {
      enabled: true,
      fromAddress,
      companyOrdersEmail,
      smtpHost: smtpHost ?? '',
      smtpPort: smtpPort ?? 465,
      smtpUser: smtpUser ?? '',
      smtpPass: smtpPass ?? '',
    };
  }
}

type EmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

type OrderNotificationItem = {
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number | string;
  lineTotal: number | string;
};

type OrderNotificationCustomer = {
  name: string;
  email: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
};

type OrderNotificationInput = {
  orderNumber: string;
  createdAt: Date;
  status?: string;
  currency?: string;
  totalAmount: number | string;
  customer: OrderNotificationCustomer;
  items: OrderNotificationItem[];
  customerNotes?: string;
};

type OrderRenderInput = OrderNotificationInput & {
  includeCustomer: boolean;
  includeStatus: boolean;
  includeNotes: boolean;
};
