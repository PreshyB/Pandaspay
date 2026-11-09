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
  brand?: string;
  options?: { name: string; values: string[] }[];
  skus?: { id: string; attributes: Record<string, string>; stockQuantity: number }[];
  stockQuantity: number;
  slug: string;
  isActive: boolean;
}

export type DeliveryZone = 'WITHIN_STATE' | 'OUTSIDE_STATE';
export type DeliverySpeed = 'STANDARD' | 'EXPRESS';

export interface DeliveryOption {
  id: string;
  sellerId: string;
  zone: DeliveryZone;
  speed: DeliverySpeed;
  feeMinor: string;
  minHours: number;
  maxHours: number;
  isActive: boolean;
}

export interface SellerDelivery {
  storeState: string | null;
  storeCity: string | null;
  options: DeliveryOption[];
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPriceMinor: string;
  skuId?: string | null;
  variant?: Record<string, string> | null;
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
  deliveryFeeMinor?: string;
  deliveryOption?: { zone: DeliveryZone; speed: DeliverySpeed; feeMinor: string; minHours: number; maxHours: number };
  deliveryAddress?: Record<string, string>;
  shippedAt?: string;
  expectedDeliveryBy?: string;
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

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_SELLER' | 'RESOLVED_BUYER' | 'RESOLVED_SPLIT';

export interface Dispute {
  id: string;
  paymentId: string;
  openedById: string;
  reason: string;
  details?: string;
  status: DisputeStatus;
  splitReleaseMinor?: string;
  splitRefundMinor?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  payment: Payment | null;
  order: Order | null;
}

export interface CreateOrderResponse {
  order: Order;
  payment: Payment;
  paymentInstruction: Record<string, unknown>;
}
