/**
 * Mirrors backend/src/common/enums — kept in sync by hand for now. If the
 * two drift, the backend's enum files are the source of truth (they carry
 * the spec references).
 */
export type OrderStatus =
  | 'CREATED'
  | 'CANCELLED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'RETURNED';

export type PaymentProtectionStatus =
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_DECLINED'
  | 'PROTECTED'
  | 'DISPUTED'
  | 'RELEASABLE'
  | 'RELEASED'
  | 'REFUND_APPROVED'
  | 'REFUNDED'
  | 'PARTIALLY_RESOLVED';

export interface Product {
  id: string;
  sellerId: string;
  title: string;
  description?: string;
  priceMinor: string;
  currency: string;
  stockQuantity: number;
  slug: string;
  isActive: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPriceMinor: string;
}

export interface Order {
  id: string;
  buyerId: string;
  sellerId: string;
  items: OrderItem[];
  status: OrderStatus;
  totalMinor: string;
  currency: string;
  deliveryConfirmedBy?: 'BUYER' | 'COURIER' | 'AUTO_TIMEOUT';
  deliveredAt?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  protectionStatus: PaymentProtectionStatus;
  amountMinor: string;
  currency: string;
  providerName: string;
  providerTransactionRef?: string;
}

export interface CreateOrderResponse {
  order: Order;
  payment: Payment;
  paymentInstruction: Record<string, unknown>;
}
