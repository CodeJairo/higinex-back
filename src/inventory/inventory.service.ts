import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { handlePrismaError } from 'src/common/helpers/prisma-error.helper';
import { PrismaService } from 'src/prisma/prisma.service';

type InventoryItemInput = {
  variantId: string;
  quantity: number;
};

type InventoryOperationOptions = {
  orderId?: string;
  reason?: string;
  notes?: string;
};

type InventoryAvailability = {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
};

type InventoryOperationResult = {
  items: Array<{
    variantId: string;
    quantity: number;
    onHandBefore: number;
    onHandAfter: number;
    reservedBefore: number;
    reservedAfter: number;
    availableBefore: number;
    availableAfter: number;
  }>;
};

type LockedBalance = {
  variantId: string;
  onHand: number;
  reserved: number;
};

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(variantIds: string[]) {
    try {
      if (!Array.isArray(variantIds) || variantIds.length === 0) {
        throw new BadRequestException('Variant ids are required');
      }

      const uniqueIds = Array.from(
        new Set(variantIds.filter((id) => typeof id === 'string' && id.trim())),
      );

      if (uniqueIds.length === 0) {
        throw new BadRequestException('Variant ids are required');
      }

      const balances = await this.prisma.inventoryBalance.findMany({
        where: { variantId: { in: uniqueIds } },
        select: {
          variantId: true,
          onHand: true,
          reserved: true,
        },
      });

      const byId = new Map(
        balances.map((balance) => [balance.variantId, balance]),
      );
      const missing = uniqueIds.filter((id) => !byId.has(id));

      if (missing.length > 0) {
        throw new NotFoundException(
          `Inventory not found for variants: ${missing.join(', ')}`,
        );
      }

      return uniqueIds.map((variantId) => {
        const balance = byId.get(variantId)!;
        return {
          variantId,
          onHand: balance.onHand,
          reserved: balance.reserved,
          available: balance.onHand - balance.reserved,
        } satisfies InventoryAvailability;
      });
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'InventoryService.getAvailability',
        defaultMessage: 'Failed to get inventory availability',
      });
    }
  }

  async reserveStock(
    items: InventoryItemInput[],
    options: InventoryOperationOptions = {},
  ) {
    try {
      const normalized = this.normalizeItems(items);

      return await this.prisma.$transaction((tx) =>
        this.reserveStockInTransaction(tx, normalized, options),
      );
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'InventoryService.reserveStock',
        defaultMessage: 'Failed to reserve stock',
      });
    }
  }

  async reserveStockWithTransaction(
    tx: Prisma.TransactionClient,
    items: InventoryItemInput[],
    options: InventoryOperationOptions = {},
  ) {
    try {
      const normalized = this.normalizeItems(items);
      return await this.reserveStockInTransaction(tx, normalized, options);
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'InventoryService.reserveStockWithTransaction',
        defaultMessage: 'Failed to reserve stock',
      });
    }
  }

  async releaseStock(
    items: InventoryItemInput[],
    options: InventoryOperationOptions = {},
  ) {
    try {
      const normalized = this.normalizeItems(items);

      return await this.prisma.$transaction((tx) =>
        this.releaseStockInTransaction(tx, normalized, options),
      );
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'InventoryService.releaseStock',
        defaultMessage: 'Failed to release reserved stock',
      });
    }
  }

  async releaseStockWithTransaction(
    tx: Prisma.TransactionClient,
    items: InventoryItemInput[],
    options: InventoryOperationOptions = {},
  ) {
    try {
      const normalized = this.normalizeItems(items);
      return await this.releaseStockInTransaction(tx, normalized, options);
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'InventoryService.releaseStockWithTransaction',
        defaultMessage: 'Failed to release reserved stock',
      });
    }
  }

  async commitStock(
    items: InventoryItemInput[],
    options: InventoryOperationOptions = {},
  ) {
    try {
      const normalized = this.normalizeItems(items);

      return await this.prisma.$transaction((tx) =>
        this.commitStockInTransaction(tx, normalized, options),
      );
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'InventoryService.commitStock',
        defaultMessage: 'Failed to commit stock',
      });
    }
  }

  async commitStockWithTransaction(
    tx: Prisma.TransactionClient,
    items: InventoryItemInput[],
    options: InventoryOperationOptions = {},
  ) {
    try {
      const normalized = this.normalizeItems(items);
      return await this.commitStockInTransaction(tx, normalized, options);
    } catch (error) {
      handlePrismaError(error, {
        logger: this.logger,
        context: 'InventoryService.commitStockWithTransaction',
        defaultMessage: 'Failed to commit stock',
      });
    }
  }

  private async reserveStockInTransaction(
    tx: Prisma.TransactionClient,
    items: InventoryItemInput[],
    options: InventoryOperationOptions,
  ) {
    const results: InventoryOperationResult['items'] = [];
    const movements: Prisma.InventoryMovementCreateManyInput[] = [];

    for (const item of items) {
      const balance = await this.lockBalance(tx, item.variantId);
      const availableBefore = balance.onHand - balance.reserved;

      if (availableBefore < item.quantity) {
        throw new ConflictException(
          `Insufficient stock for variant ${item.variantId}`,
        );
      }

      const reservedAfter = balance.reserved + item.quantity;

      await tx.inventoryBalance.update({
        where: { variantId: item.variantId },
        data: { reserved: { increment: item.quantity } },
      });

      results.push({
        variantId: item.variantId,
        quantity: item.quantity,
        onHandBefore: balance.onHand,
        onHandAfter: balance.onHand,
        reservedBefore: balance.reserved,
        reservedAfter,
        availableBefore,
        availableAfter: balance.onHand - reservedAfter,
      });

      movements.push({
        variantId: item.variantId,
        type: InventoryMovementType.ADJUSTMENT,
        quantity: item.quantity,
        reason: options.reason ?? 'RESERVE',
        notes: options.notes,
        orderId: options.orderId,
      });
    }

    if (movements.length > 0) {
      await tx.inventoryMovement.createMany({ data: movements });
    }

    return { items: results } satisfies InventoryOperationResult;
  }

  private async releaseStockInTransaction(
    tx: Prisma.TransactionClient,
    items: InventoryItemInput[],
    options: InventoryOperationOptions,
  ) {
    const results: InventoryOperationResult['items'] = [];
    const movements: Prisma.InventoryMovementCreateManyInput[] = [];

    for (const item of items) {
      const balance = await this.lockBalance(tx, item.variantId);

      if (balance.reserved < item.quantity) {
        throw new ConflictException(
          `Reserved stock is lower than requested release for variant ${item.variantId}`,
        );
      }

      const reservedAfter = balance.reserved - item.quantity;

      await tx.inventoryBalance.update({
        where: { variantId: item.variantId },
        data: { reserved: { decrement: item.quantity } },
      });

      results.push({
        variantId: item.variantId,
        quantity: item.quantity,
        onHandBefore: balance.onHand,
        onHandAfter: balance.onHand,
        reservedBefore: balance.reserved,
        reservedAfter,
        availableBefore: balance.onHand - balance.reserved,
        availableAfter: balance.onHand - reservedAfter,
      });

      movements.push({
        variantId: item.variantId,
        type: InventoryMovementType.ADJUSTMENT,
        quantity: item.quantity,
        reason: options.reason ?? 'RELEASE',
        notes: options.notes,
        orderId: options.orderId,
      });
    }

    if (movements.length > 0) {
      await tx.inventoryMovement.createMany({ data: movements });
    }

    return { items: results } satisfies InventoryOperationResult;
  }

  private async commitStockInTransaction(
    tx: Prisma.TransactionClient,
    items: InventoryItemInput[],
    options: InventoryOperationOptions,
  ) {
    const results: InventoryOperationResult['items'] = [];
    const movements: Prisma.InventoryMovementCreateManyInput[] = [];

    for (const item of items) {
      const balance = await this.lockBalance(tx, item.variantId);

      if (balance.reserved < item.quantity) {
        throw new ConflictException(
          `Reserved stock is lower than requested commit for variant ${item.variantId}`,
        );
      }

      if (balance.onHand < item.quantity) {
        throw new ConflictException(
          `On hand stock is lower than requested commit for variant ${item.variantId}`,
        );
      }

      const reservedAfter = balance.reserved - item.quantity;
      const onHandAfter = balance.onHand - item.quantity;

      await tx.inventoryBalance.update({
        where: { variantId: item.variantId },
        data: {
          reserved: { decrement: item.quantity },
          onHand: { decrement: item.quantity },
        },
      });

      results.push({
        variantId: item.variantId,
        quantity: item.quantity,
        onHandBefore: balance.onHand,
        onHandAfter,
        reservedBefore: balance.reserved,
        reservedAfter,
        availableBefore: balance.onHand - balance.reserved,
        availableAfter: onHandAfter - reservedAfter,
      });

      movements.push({
        variantId: item.variantId,
        type: InventoryMovementType.OUT,
        quantity: item.quantity,
        reason: options.reason ?? 'COMMIT',
        notes: options.notes,
        orderId: options.orderId,
      });
    }

    if (movements.length > 0) {
      await tx.inventoryMovement.createMany({ data: movements });
    }

    return { items: results } satisfies InventoryOperationResult;
  }
  private normalizeItems(items: InventoryItemInput[]) {
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
      .sort((a, b) => a.variantId.localeCompare(b.variantId));
  }

  private async lockBalance(
    tx: Prisma.TransactionClient,
    variantId: string,
  ): Promise<LockedBalance> {
    const rows = await tx.$queryRaw<LockedBalance[]>`
      SELECT "variantId", "onHand", "reserved"
      FROM "InventoryBalance"
      WHERE "variantId" = ${variantId}
      FOR UPDATE
    `;
    const balance = rows[0];

    if (!balance) {
      throw new NotFoundException(
        `Inventory balance not found for variant ${variantId}`,
      );
    }

    return balance;
  }
}
