import type { OrderStatus, PaymentProtectionStatus } from '../api/types';
import './StatusBadges.css';

/**
 * Renders the order-status and payment-protection badges as two
 * independent pieces — per the state-machine spec §1: "Every screen that
 * shows order information reads from both machines independently and
 * renders two badges, never merges them into one piece of copy." A
 * DISPUTED payment sitting next to a DELIVERED order is a real, intended
 * combination (spec §4), not a bug to hide.
 */

const ORDER_LABEL: Record<OrderStatus, string> = {
  CREATED: 'Order placed',
  CANCELLED: 'Cancelled',
  PREPARING: 'Seller preparing',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Delivery attempt failed',
  RETURNED: 'Returned to seller',
};

const PAYMENT_LABEL: Record<PaymentProtectionStatus, string> = {
  AWAITING_PAYMENT: 'Confirming payment…',
  PAYMENT_DECLINED: 'Payment declined',
  PROTECTED: 'Payment protected',
  DISPUTED: 'Payment on hold — dispute open',
  RELEASABLE: 'Pending settlement',
  RELEASED: 'Settled to seller',
  REFUND_APPROVED: 'Refund in progress',
  REFUNDED: 'Refunded',
  PARTIALLY_RESOLVED: 'Partially refunded',
};

const PAYMENT_TONE: Record<PaymentProtectionStatus, 'neutral' | 'protected' | 'amber' | 'alert'> = {
  AWAITING_PAYMENT: 'neutral',
  PAYMENT_DECLINED: 'alert',
  PROTECTED: 'protected',
  DISPUTED: 'alert',
  RELEASABLE: 'amber',
  RELEASED: 'protected',
  REFUND_APPROVED: 'amber',
  REFUNDED: 'neutral',
  PARTIALLY_RESOLVED: 'amber',
};

const ORDER_TONE: Record<OrderStatus, 'neutral' | 'protected' | 'amber' | 'alert'> = {
  CREATED: 'neutral',
  CANCELLED: 'neutral',
  PREPARING: 'neutral',
  SHIPPED: 'amber',
  IN_TRANSIT: 'amber',
  DELIVERED: 'protected',
  DELIVERY_FAILED: 'alert',
  RETURNED: 'neutral',
};

function Badge({ tone, children }: { tone: 'neutral' | 'protected' | 'amber' | 'alert'; children: string }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function StatusBadges({
  orderStatus,
  paymentStatus,
}: {
  orderStatus: OrderStatus;
  paymentStatus: PaymentProtectionStatus;
}) {
  return (
    <div className="status-badges">
      <div className="status-badges__track">
        <span className="status-badges__label">Order</span>
        <Badge tone={ORDER_TONE[orderStatus]}>{ORDER_LABEL[orderStatus]}</Badge>
      </div>
      <div className="status-badges__track">
        <span className="status-badges__label">Payment</span>
        <Badge tone={PAYMENT_TONE[paymentStatus]}>{PAYMENT_LABEL[paymentStatus]}</Badge>
      </div>
    </div>
  );
}
