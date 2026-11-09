/**
 * Order status — the fulfillment/delivery track.
 * Owned by the seller's and courier's actions.
 *
 * Source of truth: BuyBridge — Order Status & Payment Protection
 * State-Machine Specification v1.0 (8 Oct 2026), §2.
 *
 * This enum and PaymentProtectionStatus are deliberately independent.
 * Never collapse them into a single status line — see §1 of the spec.
 */
export enum OrderStatus {
  /** Order placed and payment is confirmed or in progress. Initial state. */
  CREATED = 'CREATED',
  /** Order did not proceed to fulfillment. Terminal. Always pairs with a refund. */
  CANCELLED = 'CANCELLED',
  /** Seller has accepted the order and is assembling/packing it. */
  PREPARING = 'PREPARING',
  /** Seller has marked the order dispatched. A seller claim, not courier-verified. */
  SHIPPED = 'SHIPPED',
  /** Optional: a carrier/dispatch tracking update is available. */
  IN_TRANSIT = 'IN_TRANSIT',
  /** Delivery confirmed. Starts the protection-release countdown on the payment track. */
  DELIVERED = 'DELIVERED',
  /** A delivery attempt did not succeed. Not terminal. */
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  /** Parcel confirmed back with the seller. Terminal. */
  RETURNED = 'RETURNED',
}

/**
 * Valid order-status transitions, per spec §2.2.
 * Keyed by "from" state; value is the set of states that state may move to.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.PREPARING]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED, OrderStatus.DELIVERY_FAILED],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.DELIVERY_FAILED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
  [OrderStatus.DELIVERY_FAILED]: [OrderStatus.IN_TRANSIT, OrderStatus.RETURNED],
  [OrderStatus.RETURNED]: [],
};

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
