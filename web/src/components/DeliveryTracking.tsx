import type { Order } from '../api/types';
import { feeLabel, snapshotLabel, windowLabel } from '../lib/delivery';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Delivery timing for an order: expected-by date from the window the buyer agreed to, plus a plain timeline. */
export function DeliveryTracking({ order }: { order: Order }) {
  const opt = order.deliveryOption;
  if (!opt && !order.shippedAt) return null;

  const delivered = !!order.deliveredAt;
  const late = !delivered && !!order.expectedDeliveryBy && new Date(order.expectedDeliveryBy).getTime() < Date.now();
  const addr = order.deliveryAddress;
  const cancelled = order.status === 'CANCELLED';

  return (
    <section className="track-card" aria-labelledby="track-h">
      <h2 id="track-h">Delivery</h2>

      {!cancelled && (
        <p className="eta">
          {delivered && order.deliveredAt ? (
            <>
              <strong>Delivered {day(order.deliveredAt)}</strong>
              {opt && `Promised: ${windowLabel(opt.minHours, opt.maxHours)}`}
            </>
          ) : order.expectedDeliveryBy ? (
            <>
              <strong>Expected by {day(order.expectedDeliveryBy)}</strong>
              {opt && `From the ${snapshotLabel(opt)} option you chose.`}
            </>
          ) : opt ? (
            <>
              <strong>{windowLabel(opt.minHours, opt.maxHours)} after shipping</strong>
              The expected-by date appears once the seller ships.
            </>
          ) : null}
        </p>
      )}

      {late && (
        <p className="notice notice--amber">
          This is later than expected. If your order doesn't arrive, you can report a problem below. Your payment stays protected.
        </p>
      )}

      {!cancelled && (
        <ol className="tl" aria-label="Delivery timeline">
          <li className="is-done">
            Order placed
            <small>{when(order.createdAt)}</small>
          </li>
          <li className={order.shippedAt ? 'is-done' : ''}>
            Shipped
            <small>{order.shippedAt ? when(order.shippedAt) : 'Waiting for the seller to ship'}</small>
          </li>
          <li className={delivered ? 'is-done' : ''}>
            Delivered
            <small>
              {order.deliveredAt
                ? when(order.deliveredAt)
                : order.expectedDeliveryBy
                  ? `Expected by ${day(order.expectedDeliveryBy)}`
                  : 'After shipping'}
            </small>
          </li>
        </ol>
      )}

      <p className="muted" style={{ margin: '1rem 0 0' }}>
        {addr?.street ? `To ${addr.recipientName ?? ''}, ${addr.street}, ${addr.city}, ${addr.state}. ` : ''}
        {order.deliveryFeeMinor !== undefined && `Delivery: ${feeLabel(order.deliveryFeeMinor, order.currency)}.`}
        {addr?.waybillRef && <> Waybill: <span className="mono">{addr.waybillRef}</span></>}
      </p>
    </section>
  );
}
