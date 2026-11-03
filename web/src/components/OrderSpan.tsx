import type { OrderStatus, PaymentProtectionStatus } from '../api/types';
import './OrderSpan.css';

/**
 * A readable summary of where an order is, drawn as a span with five
 * stops. It is a convenience on top of the two independent status badges
 * (see StatusBadges), never a replacement for them: the badges remain the
 * source of truth for the two state machines.
 */

const STEPS = ['Order placed', 'Payment held', 'Shipped', 'Delivered', 'Seller paid'];

const PAYMENT_HELD: PaymentProtectionStatus[] = ['PROTECTED', 'DISPUTED', 'RELEASABLE', 'RELEASED'];
const ORDER_SENT: OrderStatus[] = ['SHIPPED', 'IN_TRANSIT', 'DELIVERED'];
const ORDER_STOPPED: OrderStatus[] = ['CANCELLED', 'DELIVERY_FAILED', 'RETURNED'];
const PAYMENT_STOPPED: PaymentProtectionStatus[] = [
  'PAYMENT_DECLINED',
  'DISPUTED',
  'REFUND_APPROVED',
  'REFUNDED',
  'PARTIALLY_RESOLVED',
];

type StepState = 'done' | 'current' | 'stopped' | 'todo';

const STATE_HINT: Record<StepState, string> = {
  done: ', done',
  current: ', in progress',
  stopped: ', stopped',
  todo: ', not yet',
};

export function OrderSpan({
  orderStatus,
  paymentStatus,
}: {
  orderStatus: OrderStatus;
  paymentStatus: PaymentProtectionStatus;
}) {
  const done = [
    true,
    PAYMENT_HELD.includes(paymentStatus),
    ORDER_SENT.includes(orderStatus),
    orderStatus === 'DELIVERED',
    paymentStatus === 'RELEASED',
  ];
  const stopped = ORDER_STOPPED.includes(orderStatus) || PAYMENT_STOPPED.includes(paymentStatus);
  const firstOpen = done.indexOf(false);

  return (
    <ol className="span" aria-label="Order progress">
      {STEPS.map((label, i) => {
        let state: StepState = 'todo';
        if (done[i]) state = 'done';
        else if (i === firstOpen) state = stopped ? 'stopped' : 'current';

        return (
          <li
            key={label}
            className={`span__step span__step--${state}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            {label}
            <span className="sr-only">{STATE_HINT[state]}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** One plain sentence for the situations the five stops can't express. */
export function statusNotice(
  orderStatus: OrderStatus,
  paymentStatus: PaymentProtectionStatus,
): { tone: 'neutral' | 'amber' | 'alert'; text: string } | null {
  if (paymentStatus === 'DISPUTED') {
    return { tone: 'alert', text: "A dispute is open. The payment is on hold until it's resolved." };
  }
  if (paymentStatus === 'PAYMENT_DECLINED') {
    return { tone: 'alert', text: 'The payment was declined.' };
  }
  if (paymentStatus === 'REFUND_APPROVED') {
    return { tone: 'amber', text: 'A refund has been approved and is being processed.' };
  }
  if (paymentStatus === 'REFUNDED') {
    return { tone: 'neutral', text: 'This payment was refunded.' };
  }
  if (paymentStatus === 'PARTIALLY_RESOLVED') {
    return { tone: 'amber', text: 'Part of this payment was refunded.' };
  }
  if (orderStatus === 'CANCELLED') {
    return { tone: 'neutral', text: 'This order was cancelled.' };
  }
  if (orderStatus === 'DELIVERY_FAILED') {
    return { tone: 'alert', text: 'The delivery attempt failed.' };
  }
  if (orderStatus === 'RETURNED') {
    return { tone: 'neutral', text: 'The order was returned to the seller.' };
  }
  return null;
}
