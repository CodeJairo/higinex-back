import { OrderStatus } from '@prisma/client';

export const PENDING_RESERVATION_STATUSES: OrderStatus[] = [
  OrderStatus.CREATED,
  OrderStatus.PENDING_PAYMENT,
];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELED],
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELED],
  [OrderStatus.PAID]: [],
  [OrderStatus.PREPARING]: [],
  [OrderStatus.SHIPPED]: [],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELED]: [],
  [OrderStatus.RETURN_REQUESTED]: [],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.REFUNDED]: [],
};

export const INVENTORY_REASONS = {
  RESERVE: 'RESERVE',
  RELEASE: 'RELEASE',
  COMMIT: 'COMMIT',
  EXPIRE: 'EXPIRE',
} as const;
