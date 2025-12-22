import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
  Role,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { ValidatedUserPayload } from 'src/auth/interfaces/validated-user-payload.interface';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { InventoryService } from 'src/inventory/inventory.service';
import { EmailService } from 'src/notifications/email/email.service';
import { PricingService } from 'src/pricing/pricing.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  NormalizedOrderItem,
  OrderCreateInputWithoutNumber,
  OrderItemSnapshot,
  VariantSnapshot,
} from './interfaces/orders.types';
import {
  INVENTORY_REASONS,
  ORDER_TRANSITIONS,
  PENDING_RESERVATION_STATUSES,
} from './orders.constants';

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;
type OrderWithItemsAndAddress = Prisma.OrderGetPayload<{
  include: { items: true; shippingAddress: true };
}>;
type CreatedOrder = OrderWithItemsAndAddress & { reservationExpiresAt: Date };
type ConfirmedPayment = { id: string; paidAt: Date | null };

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly inventoryService: InventoryService,
    private readonly pricingService: PricingService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    const items = this.normalizeItems(dto.items);

    try {
      const order = await this.prisma.$transaction((tx) =>
        this.createOrderTransaction(tx, userId, dto, items),
      );

      await this.notifyOrderCreated(order);

      return order;
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'OrdersService.createOrder',
        defaultMessage: 'Failed to create order',
      });
    }
  }

  async confirmPayment(
    orderId: string,
    userId: string,
    dto: ConfirmPaymentDto,
  ) {
    try {
      return await this.prisma.$transaction((tx) =>
        this.confirmPaymentTransaction(tx, orderId, userId, dto),
      );
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'OrdersService.confirmPayment',
        defaultMessage: 'Failed to confirm payment',
      });
    }
  }

  async cancelOrder(
    orderId: string,
    user: ValidatedUserPayload,
    dto: CancelOrderDto,
  ) {
    try {
      return await this.prisma.$transaction((tx) =>
        this.cancelOrderTransaction(tx, orderId, user, dto),
      );
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'OrdersService.cancelOrder',
        defaultMessage: 'Failed to cancel order',
      });
    }
  }

  async expireReservations(userId: string) {
    try {
      const candidates = await this.findExpiredReservationCandidates();
      const expiredOrderIds: string[] = [];

      for (const order of candidates) {
        const expiredId = await this.prisma.$transaction((tx) =>
          this.expireReservationForOrder(tx, order.id, userId),
        );

        if (expiredId) {
          expiredOrderIds.push(expiredId);
        }
      }

      return {
        checkedCount: candidates.length,
        expiredCount: expiredOrderIds.length,
        expiredOrderIds,
      };
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'OrdersService.expireReservations',
        defaultMessage: 'Failed to expire reservations',
      });
    }
  }

  private async createOrderTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    dto: CreateOrderDto,
    items: NormalizedOrderItem[],
  ): Promise<CreatedOrder> {
    const customer = await this.getCustomerForUser(tx, userId);
    const variants = await this.getActiveVariants(tx, items);
    const prices =
      await this.pricingService.getVariantPricesForCustomerWithTransaction(
        tx,
        customer.id,
        items.map((item) => item.variantId),
      );

    const orderItems = this.buildOrderItems(items, variants, prices);
    const totals = this.calculateTotals(orderItems);
    const shippingAddressData = await this.getShippingAddressData(
      tx,
      dto.shippingAddressId,
      customer,
    );

    const orderData: OrderCreateInputWithoutNumber = {
      status: OrderStatus.PENDING_PAYMENT,
      customer: { connect: { id: customer.id } },
      buyerFullName: customer.name,
      buyerEmail: customer.email,
      buyerPhone: customer.phone,
      buyerDocumentType: customer.documentType,
      buyerDocumentNumber: customer.documentNumber,
      subtotalAmount: totals.subtotalAmount,
      shippingAmount: totals.shippingAmount,
      discountAmount: totals.discountAmount,
      totalAmount: totals.totalAmount,
      customerNotes: dto.customerNotes,
      items: { create: orderItems },
      shippingAddress: shippingAddressData
        ? { create: shippingAddressData }
        : undefined,
    };

    const include = { items: true, shippingAddress: true } as const;
    const order = await this.createOrderWithUniqueNumber(
      tx,
      orderData,
      include,
    );

    await this.inventoryService.reserveStockWithTransaction(tx, items, {
      orderId: order.id,
      reason: INVENTORY_REASONS.RESERVE,
    });

    await this.createStatusHistory(tx, {
      orderId: order.id,
      toStatus: order.status,
      changedByUserId: userId,
      comment: 'Order created and stock reserved',
    });

    return {
      ...order,
      reservationExpiresAt: this.getReservationExpiresAt(order.createdAt),
    };
  }

  private async confirmPaymentTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    userId: string,
    dto: ConfirmPaymentDto,
  ) {
    const order = await this.getOrderForUpdate(tx, orderId);
    const existingPayment = await this.getConfirmedPayment(tx, order.id);

    if (order.status === OrderStatus.PAID) {
      this.assertPaidOrderConsistency(existingPayment);
      return order;
    }

    if (existingPayment) {
      this.ensureTransitionAllowed(order.status, OrderStatus.PAID);
      const paidAt = existingPayment.paidAt ?? new Date();
      return await this.markOrderPaid(
        tx,
        order,
        paidAt,
        userId,
        'Payment already confirmed',
      );
    }

    if (await this.cancelIfReservationExpired(tx, order, userId)) {
      throw new ConflictException('Reservation expired. Order was canceled.');
    }

    this.ensureTransitionAllowed(order.status, OrderStatus.PAID);

    const items = this.mapOrderItemsToInventory(order.items);
    await this.inventoryService.commitStockWithTransaction(tx, items, {
      orderId: order.id,
      reason: INVENTORY_REASONS.COMMIT,
    });

    const paymentAmount = this.resolvePaymentAmount(order, dto);
    const paidAt = new Date();

    await this.createPayment(tx, order.id, dto, paymentAmount, paidAt);

    return await this.markOrderPaid(
      tx,
      order,
      paidAt,
      userId,
      'Payment confirmed',
    );
  }

  private async cancelOrderTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    user: ValidatedUserPayload,
    dto: CancelOrderDto,
  ) {
    const order = await this.getOrderForUpdate(tx, orderId);

    if (order.status === OrderStatus.CANCELED) {
      return order;
    }

    await this.assertCancelPermissions(tx, order, user);

    const expiredOrder = await this.cancelIfReservationExpired(
      tx,
      order,
      user.id,
    );

    if (expiredOrder) {
      return expiredOrder;
    }

    this.ensureTransitionAllowed(order.status, OrderStatus.CANCELED);

    const items = this.mapOrderItemsToInventory(order.items);
    await this.inventoryService.releaseStockWithTransaction(tx, items, {
      orderId: order.id,
      reason: INVENTORY_REASONS.RELEASE,
    });

    return await this.markOrderCanceled(tx, order, user.id, dto.comment);
  }

  private async expireReservationForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    userId: string,
  ) {
    await this.lockOrderForUpdate(tx, orderId);

    const order = await tx.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { items: true },
    });

    if (!order) return null;

    const updated = await this.cancelIfReservationExpired(tx, order, userId);
    return updated?.id ?? null;
  }

  private async findExpiredReservationCandidates() {
    const cutoff = this.getReservationExpiryCutoff();
    return this.prisma.order.findMany({
      where: {
        deletedAt: null,
        status: { in: PENDING_RESERVATION_STATUSES },
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });
  }

  private normalizeItems(items: CreateOrderDto['items']) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Items are required');
    }

    const totals = new Map<string, number>();

    for (const item of items) {
      if (
        !item ||
        typeof item.variantId !== 'string' ||
        !item.variantId.trim()
      ) {
        throw new BadRequestException('Invalid variant id');
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException('Quantity must be a positive integer');
      }

      const current = totals.get(item.variantId) ?? 0;
      totals.set(item.variantId, current + item.quantity);
    }

    return Array.from(totals.entries())
      .map(([variantId, quantity]) => ({ variantId, quantity }))
      .sort((a, b) =>
        a.variantId.localeCompare(b.variantId),
      ) satisfies NormalizedOrderItem[];
  }

  private async getCustomerForUser(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const customer = await tx.customer.findFirst({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        documentType: true,
        documentNumber: true,
      },
    });

    if (!customer) {
      throw new BadRequestException('Customer profile not found for user');
    }

    return customer;
  }

  private async getActiveVariants(
    tx: Prisma.TransactionClient,
    items: NormalizedOrderItem[],
  ) {
    const variantIds = items.map((item) => item.variantId);
    const variants = await tx.productVariant.findMany({
      where: {
        id: { in: variantIds },
        deletedAt: null,
        isActive: true,
        product: { deletedAt: null, status: ProductStatus.PUBLISHED },
      },
      select: {
        id: true,
        sku: true,
        gtin: true,
        name: true,
        product: { select: { name: true } },
      },
    });

    const variantsById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );
    const missingVariants = variantIds.filter((id) => !variantsById.has(id));

    if (missingVariants.length > 0) {
      throw new NotFoundException(
        `Variants not found or inactive: ${missingVariants.join(', ')}`,
      );
    }

    return variantsById as Map<string, VariantSnapshot>;
  }

  private buildOrderItems(
    items: NormalizedOrderItem[],
    variantsById: Map<string, VariantSnapshot>,
    prices: Array<{ variantId: string; unitPriceCop: Prisma.Decimal | number }>,
  ) {
    const pricesByVariantId = new Map(
      prices.map((price) => [price.variantId, price.unitPriceCop]),
    );

    return items.map((item) => {
      const variant = variantsById.get(item.variantId);
      const unitPrice = pricesByVariantId.get(item.variantId);

      if (!variant || unitPrice === undefined) {
        throw new NotFoundException(
          `Price not found for variant ${item.variantId}`,
        );
      }

      const unitPriceAmount = new Prisma.Decimal(unitPrice);
      const lineTotalAmount = unitPriceAmount.mul(item.quantity);

      return {
        variantId: item.variantId,
        skuSnapshot: variant.sku,
        gtinSnapshot: variant.gtin,
        productNameSnapshot: variant.product.name,
        variantNameSnapshot: variant.name,
        unitPriceAmount,
        quantity: item.quantity,
        lineTotalAmount,
      } satisfies OrderItemSnapshot;
    });
  }

  private calculateTotals(orderItems: OrderItemSnapshot[]) {
    const subtotalAmount = orderItems.reduce(
      (sum, item) => sum.plus(item.lineTotalAmount),
      new Prisma.Decimal(0),
    );

    const shippingAmount = new Prisma.Decimal(0);
    const discountAmount = new Prisma.Decimal(0);
    const totalAmount = subtotalAmount
      .minus(discountAmount)
      .plus(shippingAmount);

    return { subtotalAmount, shippingAmount, discountAmount, totalAmount };
  }

  private async getShippingAddressData(
    tx: Prisma.TransactionClient,
    shippingAddressId: string | undefined,
    customer: { id: string; name: string; phone: string },
  ): Promise<Prisma.OrderAddressCreateWithoutOrderInput | null> {
    if (!shippingAddressId) return null;

    const address = await tx.customerAddress.findFirst({
      where: {
        id: shippingAddressId,
        customerId: customer.id,
        deletedAt: null,
      },
      select: {
        line1: true,
        line2: true,
        neighborhood: true,
        city: true,
        state: true,
        postalCode: true,
        notes: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Shipping address not found');
    }

    return {
      recipientName: customer.name,
      phone: customer.phone,
      line1: address.line1,
      line2: address.line2,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      notes: address.notes,
    };
  }

  private mapOrderItemsToInventory(
    items: Array<{ id: string; variantId: string | null; quantity: number }>,
  ) {
    return items.map((item) => {
      if (!item.variantId) {
        throw new ConflictException(
          `Order item ${item.id} is missing variant reference`,
        );
      }

      return { variantId: item.variantId, quantity: item.quantity };
    });
  }

  private async assertCancelPermissions(
    tx: Prisma.TransactionClient,
    order: { customerId: string | null },
    user: ValidatedUserPayload,
  ) {
    if (user.role === Role.ADMIN) return;

    const customer = await tx.customer.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });

    if (!customer || order.customerId !== customer.id) {
      throw new ForbiddenException('Not allowed to cancel this order');
    }
  }

  private ensureTransitionAllowed(current: OrderStatus, target: OrderStatus) {
    if (current === target) return;

    const allowed = ORDER_TRANSITIONS[current] ?? [];
    if (!allowed.includes(target)) {
      throw new ConflictException(
        `Order cannot transition from ${current} to ${target}`,
      );
    }
  }

  private isReservationExpired(order: {
    createdAt: Date;
    status: OrderStatus;
  }) {
    if (!PENDING_RESERVATION_STATUSES.includes(order.status)) {
      return false;
    }

    return new Date() > this.getReservationExpiresAt(order.createdAt);
  }

  private async cancelIfReservationExpired(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      status: OrderStatus;
      createdAt: Date;
      items: Array<{ id: string; variantId: string | null; quantity: number }>;
    },
    userId: string,
  ) {
    if (!this.isReservationExpired(order)) {
      return null;
    }

    if (order.status === OrderStatus.CANCELED) {
      return order;
    }

    const items = this.mapOrderItemsToInventory(order.items);

    await this.inventoryService.releaseStockWithTransaction(tx, items, {
      orderId: order.id,
      reason: INVENTORY_REASONS.EXPIRE,
    });

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELED },
    });

    await this.createStatusHistory(tx, {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: OrderStatus.CANCELED,
      changedByUserId: userId,
      comment: 'Reservation expired',
    });

    return updated;
  }

  private resolvePaymentAmount(
    order: { totalAmount: Prisma.Decimal },
    dto: ConfirmPaymentDto,
  ) {
    if (dto.amount === undefined) {
      return order.totalAmount;
    }

    const paymentAmount = new Prisma.Decimal(dto.amount);

    if (!order.totalAmount.equals(paymentAmount)) {
      throw new BadRequestException(
        'Payment amount must match order total amount',
      );
    }

    return paymentAmount;
  }

  private async notifyOrderCreated(order: CreatedOrder) {
    const notification = this.buildOrderNotification(order);
    if (!notification) return;

    try {
      await Promise.all([
        this.emailService.sendOrderCreatedToCompany(notification),
        this.emailService.sendOrderCreatedToCustomer(notification),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to send order email for ${order.orderNumber}`,
        error as Error,
      );
    }
  }

  private buildOrderNotification(order: CreatedOrder) {
    if (!order.buyerEmail || !order.buyerFullName) {
      this.logger.warn(
        `Skipping order email for ${order.orderNumber}: missing buyer data`,
      );
      return null;
    }

    return {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      currency: order.currency,
      subtotalAmount: order.subtotalAmount.toString(),
      shippingAmount: order.shippingAmount.toString(),
      discountAmount: order.discountAmount.toString(),
      totalAmount: order.totalAmount.toString(),
      customerNotes: order.customerNotes ?? undefined,
      customer: {
        name: order.buyerFullName,
        email: order.buyerEmail,
        phone: order.buyerPhone ?? undefined,
        documentType: order.buyerDocumentType ?? undefined,
        documentNumber: order.buyerDocumentNumber ?? undefined,
      },
      items: order.items.map((item) => ({
        productName: item.productNameSnapshot,
        variantName: item.variantNameSnapshot ?? undefined,
        quantity: item.quantity,
        unitPrice: item.unitPriceAmount.toString(),
        lineTotal: item.lineTotalAmount.toString(),
      })),
    };
  }

  private async createOrderWithUniqueNumber<
    TInclude extends Prisma.OrderCreateArgs['include'],
  >(
    tx: Prisma.TransactionClient,
    data: OrderCreateInputWithoutNumber,
    include?: TInclude,
  ): Promise<Prisma.OrderGetPayload<{ include: TInclude }>> {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const dataWithNumber: Prisma.OrderCreateInput = {
          ...data,
          orderNumber: this.generateOrderNumber(),
        };
        const created = await tx.order.create({
          data: dataWithNumber,
          include,
        });
        return created as Prisma.OrderGetPayload<{ include: TInclude }>;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const fields = Array.isArray(error.meta?.target)
            ? error.meta.target
            : [];
          if (fields.includes('orderNumber')) {
            continue;
          }
        }
        throw error;
      }
    }

    this.logger.warn('Failed to generate unique order number after retries');
    throw new ConflictException('Failed to generate unique order number');
  }

  private async getOrderForUpdate(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<OrderWithItems> {
    await this.lockOrderForUpdate(tx, orderId);

    const order = await tx.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { items: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    return order;
  }

  private async getConfirmedPayment(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<ConfirmedPayment | null> {
    return await tx.payment.findFirst({
      where: { orderId, status: PaymentStatus.CONFIRMED },
      select: { id: true, paidAt: true },
    });
  }

  private assertPaidOrderConsistency(existingPayment: ConfirmedPayment | null) {
    if (existingPayment) return;

    throw new ConflictException(
      'Order is marked as paid but has no confirmed payment',
    );
  }

  private async createPayment(
    tx: Prisma.TransactionClient,
    orderId: string,
    dto: ConfirmPaymentDto,
    amount: Prisma.Decimal,
    paidAt: Date,
  ) {
    await tx.payment.create({
      data: {
        orderId,
        method: dto.method,
        status: PaymentStatus.CONFIRMED,
        amount,
        paidAt,
        reference: dto.reference,
        notes: dto.notes,
      },
    });
  }

  private async markOrderPaid(
    tx: Prisma.TransactionClient,
    order: { id: string; status: OrderStatus },
    paidAt: Date,
    userId: string,
    comment: string,
  ) {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PAID, paidAt },
    });

    await this.createStatusHistory(tx, {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: OrderStatus.PAID,
      changedByUserId: userId,
      comment,
    });

    return updated;
  }

  private async markOrderCanceled(
    tx: Prisma.TransactionClient,
    order: { id: string; status: OrderStatus },
    userId: string,
    comment?: string,
  ) {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELED },
    });

    await this.createStatusHistory(tx, {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: OrderStatus.CANCELED,
      changedByUserId: userId,
      comment,
    });

    return updated;
  }

  private async lockOrderForUpdate(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    await tx.$queryRaw`
      SELECT "id"
      FROM "Order"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;
  }

  private async createStatusHistory(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      fromStatus?: OrderStatus;
      toStatus: OrderStatus;
      changedByUserId?: string;
      comment?: string;
    },
  ) {
    await tx.orderStatusHistory.create({
      data: {
        orderId: input.orderId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        changedByUserId: input.changedByUserId,
        comment: input.comment,
      },
    });
  }

  private generateOrderNumber() {
    return `ORD-${randomUUID().slice(0, 12).toUpperCase()}`;
  }

  private getReservationExpiryCutoff() {
    return new Date(Date.now() - this.getReservationTtlMs());
  }

  private getReservationExpiresAt(createdAt: Date) {
    return new Date(createdAt.getTime() + this.getReservationTtlMs());
  }

  private getReservationTtlMs() {
    return (
      this.config.getOrThrow<number>('RESERVATION_TTL_MINUTES') * 60 * 1000
    );
  }
}
