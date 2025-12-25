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

    const subject = `Nuevo pedido ${input.orderNumber}`;
    const content = this.renderCompanyOrderEmail(input);

    await this.sendMail({
      to: this.companyOrdersEmail,
      subject,
      text: content.text,
      html: content.html,
    });
  }

  async sendOrderCreatedToCustomer(input: OrderNotificationInput) {
    const subject = `Pedido recibido ${input.orderNumber}`;
    const content = this.renderCustomerOrderEmail(input, {
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
    const subject = `Actualizacion de pedido ${input.orderNumber}`;
    const content = this.renderCustomerOrderEmail(input, {
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

  async sendEmailVerificationLink(input: EmailVerificationLinkInput) {
    const subject = 'Verifica tu correo';
    const text = [
      'Confirma tu correo usando el siguiente enlace:',
      input.link,
      '',
      `Este enlace vence en ${input.expiresInMinutes} minutos.`,
    ].join('\n');

    await this.sendMail({
      to: input.email,
      subject,
      text,
    });
  }

  async sendPasswordResetCode(input: AuthCodeEmailInput) {
    const subject = 'Codigo para restablecer tu contrasena';
    const text = [
      `Tu codigo para restablecer la contrasena es ${input.code}.`,
      `Este codigo vence en ${input.expiresInMinutes} minutos.`,
    ].join('\n');

    await this.sendMail({
      to: input.email,
      subject,
      text,
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

  private renderCustomerOrderEmail(
    input: OrderNotificationInput,
    options: { includeNotes: boolean; includeStatus: boolean },
  ) {
    const summary = this.buildOrderSummary(input);
    const statusLine = options.includeStatus
      ? `Estado: ${summary.statusLabel}`
      : '';
    const notesLine =
      options.includeNotes && input.customerNotes
        ? `Notas: ${input.customerNotes}`
        : '';
    const customerName = input.customer.name;
    const brand = 'Higinex';

    const text = [
      `Hola ${customerName},`,
      '',
      `Gracias por tu compra en ${brand}. Recibimos tu pedido y lo estamos procesando.`,
      '',
      `Pedido: ${input.orderNumber}`,
      `Fecha: ${summary.createdAtLabel}`,
      statusLine,
      '',
      'Resumen de tu pedido:',
      ...summary.items.map(
        (item) =>
          `- ${item.displayName} | Cantidad: ${item.quantity} | Precio unitario: ${item.unitPriceFormatted} | Total: ${item.lineTotalFormatted}`,
      ),
      '',
      `Subtotal: ${summary.subtotalFormatted}`,
      `Envio: ${summary.shippingFormatted}`,
      `Descuentos: ${summary.discountFormatted}`,
      `Total: ${summary.totalFormatted}`,
      notesLine,
      '',
      `Te avisaremos cuando el estado cambie.`,
      `Equipo ${brand}`,
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111;">
        <h2 style="margin-bottom: 4px;">Hola ${this.escapeHtml(
          customerName,
        )},</h2>
        <p style="margin-top: 0;">Gracias por tu compra en ${this.escapeHtml(
          brand,
        )}. Recibimos tu pedido y lo estamos procesando.</p>
        <div style="background: #f7f7f7; padding: 12px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Pedido:</strong> ${this.escapeHtml(
            input.orderNumber,
          )}</p>
          <p style="margin: 6px 0 0;"><strong>Fecha:</strong> ${this.escapeHtml(
            summary.createdAtLabel,
          )}</p>
          ${
            statusLine
              ? `<p style="margin: 6px 0 0;"><strong>${this.escapeHtml(
                  statusLine,
                )}</strong></p>`
              : ''
          }
        </div>
        <h3 style="margin-bottom: 8px;">Resumen de tu pedido</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr>
              <th style="text-align: left; border-bottom: 1px solid #ddd; padding: 6px;">Producto</th>
              <th style="text-align: right; border-bottom: 1px solid #ddd; padding: 6px;">Cantidad</th>
              <th style="text-align: right; border-bottom: 1px solid #ddd; padding: 6px;">Precio unitario</th>
              <th style="text-align: right; border-bottom: 1px solid #ddd; padding: 6px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${summary.items
              .map(
                (item) => `
              <tr>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${this.escapeHtml(
                  item.displayName,
                )}</td>
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
        <table style="width: 100%; margin-top: 12px; font-size: 13px;">
          <tbody>
            <tr>
              <td style="text-align: right; padding: 4px 0;">Subtotal:</td>
              <td style="text-align: right; padding: 4px 0; width: 120px;">${this.escapeHtml(
                summary.subtotalFormatted,
              )}</td>
            </tr>
            <tr>
              <td style="text-align: right; padding: 4px 0;">Envio:</td>
              <td style="text-align: right; padding: 4px 0;">${this.escapeHtml(
                summary.shippingFormatted,
              )}</td>
            </tr>
            <tr>
              <td style="text-align: right; padding: 4px 0;">Descuentos:</td>
              <td style="text-align: right; padding: 4px 0;">${this.escapeHtml(
                summary.discountFormatted,
              )}</td>
            </tr>
            <tr>
              <td style="text-align: right; padding: 6px 0; font-weight: bold;">Total:</td>
              <td style="text-align: right; padding: 6px 0; font-weight: bold;">${this.escapeHtml(
                summary.totalFormatted,
              )}</td>
            </tr>
          </tbody>
        </table>
        ${
          notesLine
            ? `<p style="margin-top: 12px;"><strong>Notas:</strong> ${this.escapeHtml(
                input.customerNotes ?? '',
              )}</p>`
            : ''
        }
        <p style="margin-top: 16px;">Te avisaremos cuando el estado cambie.</p>
        <p style="margin-top: 12px;">Equipo ${this.escapeHtml(brand)}</p>
      </div>
    `.trim();

    return { text, html };
  }

  private renderCompanyOrderEmail(input: OrderNotificationInput) {
    const summary = this.buildOrderSummary(input);
    const statusLine = `Estado: ${summary.statusLabel}`;

    const text = [
      'Nuevo pedido recibido',
      '',
      `Pedido: ${input.orderNumber}`,
      `Fecha: ${summary.createdAtLabel}`,
      statusLine,
      '',
      'Cliente:',
      `Nombre: ${input.customer.name}`,
      `Email: ${input.customer.email}`,
      input.customer.phone ? `Telefono: ${input.customer.phone}` : '',
      input.customer.documentType && input.customer.documentNumber
        ? `Documento: ${input.customer.documentType} ${input.customer.documentNumber}`
        : '',
      '',
      'Items:',
      ...summary.items.map(
        (item) =>
          `- ${item.displayName} | Cantidad: ${item.quantity} | Precio unitario: ${item.unitPriceFormatted} | Total: ${item.lineTotalFormatted}`,
      ),
      '',
      `Subtotal: ${summary.subtotalFormatted}`,
      `Envio: ${summary.shippingFormatted}`,
      `Descuentos: ${summary.discountFormatted}`,
      `Total: ${summary.totalFormatted}`,
      input.customerNotes ? `Notas: ${input.customerNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111;">
        <h2 style="margin-bottom: 4px;">Nuevo pedido recibido</h2>
        <div style="background: #f7f7f7; padding: 12px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0;"><strong>Pedido:</strong> ${this.escapeHtml(
            input.orderNumber,
          )}</p>
          <p style="margin: 6px 0 0;"><strong>Fecha:</strong> ${this.escapeHtml(
            summary.createdAtLabel,
          )}</p>
          <p style="margin: 6px 0 0;"><strong>${this.escapeHtml(
            statusLine,
          )}</strong></p>
        </div>
        <h3 style="margin-bottom: 8px;">Cliente</h3>
        <p style="margin: 0;"><strong>Nombre:</strong> ${this.escapeHtml(
          input.customer.name,
        )}</p>
        <p style="margin: 4px 0 0;"><strong>Email:</strong> ${this.escapeHtml(
          input.customer.email,
        )}</p>
        ${
          input.customer.phone
            ? `<p style="margin: 4px 0 0;"><strong>Telefono:</strong> ${this.escapeHtml(
                input.customer.phone,
              )}</p>`
            : ''
        }
        ${
          input.customer.documentType && input.customer.documentNumber
            ? `<p style="margin: 4px 0 0;"><strong>Documento:</strong> ${this.escapeHtml(
                `${input.customer.documentType} ${input.customer.documentNumber}`,
              )}</p>`
            : ''
        }
        <h3 style="margin: 16px 0 8px;">Items</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr>
              <th style="text-align: left; border-bottom: 1px solid #ddd; padding: 6px;">Producto</th>
              <th style="text-align: right; border-bottom: 1px solid #ddd; padding: 6px;">Cantidad</th>
              <th style="text-align: right; border-bottom: 1px solid #ddd; padding: 6px;">Precio unitario</th>
              <th style="text-align: right; border-bottom: 1px solid #ddd; padding: 6px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${summary.items
              .map(
                (item) => `
              <tr>
                <td style="padding: 6px; border-bottom: 1px solid #eee;">${this.escapeHtml(
                  item.displayName,
                )}</td>
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
        <table style="width: 100%; margin-top: 12px; font-size: 13px;">
          <tbody>
            <tr>
              <td style="text-align: right; padding: 4px 0;">Subtotal:</td>
              <td style="text-align: right; padding: 4px 0; width: 120px;">${this.escapeHtml(
                summary.subtotalFormatted,
              )}</td>
            </tr>
            <tr>
              <td style="text-align: right; padding: 4px 0;">Envio:</td>
              <td style="text-align: right; padding: 4px 0;">${this.escapeHtml(
                summary.shippingFormatted,
              )}</td>
            </tr>
            <tr>
              <td style="text-align: right; padding: 4px 0;">Descuentos:</td>
              <td style="text-align: right; padding: 4px 0;">${this.escapeHtml(
                summary.discountFormatted,
              )}</td>
            </tr>
            <tr>
              <td style="text-align: right; padding: 6px 0; font-weight: bold;">Total:</td>
              <td style="text-align: right; padding: 6px 0; font-weight: bold;">${this.escapeHtml(
                summary.totalFormatted,
              )}</td>
            </tr>
          </tbody>
        </table>
        ${
          input.customerNotes
            ? `<p style="margin-top: 12px;"><strong>Notas:</strong> ${this.escapeHtml(
                input.customerNotes,
              )}</p>`
            : ''
        }
      </div>
    `.trim();

    return { text, html };
  }

  private buildOrderSummary(input: OrderNotificationInput) {
    const currency = input.currency ?? 'COP';
    const createdAtLabel = this.formatDate(input.createdAt);
    const statusLabel = this.getStatusLabel(input.status);

    const items = input.items.map((item) => {
      const displayName = this.formatItemName(
        item.productName,
        item.variantName,
      );
      const unitPriceFormatted = this.formatCurrency(item.unitPrice, currency);
      const lineTotalFormatted = this.formatCurrency(item.lineTotal, currency);

      return {
        displayName,
        quantity: item.quantity,
        unitPriceFormatted,
        lineTotalFormatted,
        lineTotalValue: this.toNumber(item.lineTotal) ?? 0,
      };
    });

    const computedSubtotal = items.reduce(
      (sum, item) => sum + item.lineTotalValue,
      0,
    );

    const subtotalValue =
      this.toNumber(input.subtotalAmount) ?? computedSubtotal;
    const shippingValue = this.toNumber(input.shippingAmount) ?? 0;
    const discountValue = this.toNumber(input.discountAmount) ?? 0;
    const totalValue =
      this.toNumber(input.totalAmount) ??
      subtotalValue + shippingValue - discountValue;

    return {
      createdAtLabel,
      statusLabel,
      items,
      subtotalFormatted: this.formatCurrency(subtotalValue, currency),
      shippingFormatted: this.formatCurrency(shippingValue, currency),
      discountFormatted: this.formatCurrency(discountValue, currency),
      totalFormatted: this.formatCurrency(totalValue, currency),
    };
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
      return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return String(date);
    }
  }

  private getStatusLabel(status?: string) {
    if (!status) return 'En proceso';

    const labels: Record<string, string> = {
      CREATED: 'Creado',
      PENDING_PAYMENT: 'Pendiente de pago',
      PAID: 'Pagado',
      PREPARING: 'En preparacion',
      SHIPPED: 'Enviado',
      DELIVERED: 'Entregado',
      CANCELED: 'Cancelado',
      RETURN_REQUESTED: 'Devolucion solicitada',
      RETURNED: 'Devuelto',
      REFUNDED: 'Reembolsado',
    };

    return labels[status] ?? 'En proceso';
  }

  private formatItemName(productName: string, variantName?: string) {
    if (!variantName || variantName.trim().length === 0) {
      return productName;
    }

    return `${productName} - ${variantName}`;
  }

  private toNumber(value: number | string | undefined | null) {
    if (value === undefined || value === null) return null;
    const numeric = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(numeric) ? numeric : null;
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

type EmailVerificationLinkInput = {
  email: string;
  link: string;
  expiresInMinutes: number;
};

type AuthCodeEmailInput = {
  email: string;
  code: string;
  expiresInMinutes: number;
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
  subtotalAmount?: number | string;
  shippingAmount?: number | string;
  discountAmount?: number | string;
  totalAmount: number | string;
  customer: OrderNotificationCustomer;
  items: OrderNotificationItem[];
  customerNotes?: string;
};
