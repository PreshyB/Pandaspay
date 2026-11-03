import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Order, Payment } from '../api/types';
import { OrderSpan, statusNotice } from '../components/OrderSpan';
import { StatusBadges } from '../components/StatusBadges';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';

type OrderWithPayment = Order & { payment: Payment };

export default function OrderStatusPage() {
  const { orderId = '' } = useParams();
  const [order, setOrder] = useState<OrderWithPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  const { user: buyer } = useDevIdentity('buyer');

  const refresh = useCallback(() => {
    api.getOrder(orderId).then(setOrder).catch(() => setError('Could not load this order.'));
  }, [orderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That action failed.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) {
    return (
      <div className="card empty">
        <h1>We can't open that order</h1>
        <p>{error}</p>
        <Link className="btn" to="/">
          Back to home
        </Link>
      </div>
    );
  }
  if (!order) return <p className="muted">Loading order…</p>;

  const { payment } = order;
  const canSimulatePayment = payment.protectionStatus === 'AWAITING_PAYMENT' && payment.providerTransactionRef;
  const canConfirmDelivered = order.status === 'SHIPPED' || order.status === 'IN_TRANSIT';
  const canDispute = payment.protectionStatus === 'PROTECTED' || payment.protectionStatus === 'RELEASABLE';
  const notice = statusNotice(order.status, payment.protectionStatus);

  return (
    <div className="order">
      <div className="order__head">
        <div>
          <h1>Order</h1>
          <p className="mono">{order.id}</p>
        </div>
        <div className="order__sum">
          <div className="order__total">{formatMoney(order.totalMinor, order.currency)}</div>
          <p className="muted">
            {order.items.length} item{order.items.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="panel">
        <OrderSpan orderStatus={order.status} paymentStatus={payment.protectionStatus} />

        {notice && <p className={`notice notice--${notice.tone}`}>{notice.text}</p>}

        <div className="order__badges">
          <StatusBadges orderStatus={order.status} paymentStatus={payment.protectionStatus} />
        </div>

        {error && <p className="error">{error}</p>}

        {canSimulatePayment && (
          <div className="testbar">
            <span>Test mode: the payment provider is simulated.</span>
            <button
              className="btn btn--secondary"
              disabled={busy}
              onClick={() => run(() => api.simulatePaymentConfirmed(payment.providerTransactionRef!))}
            >
              Simulate payment confirmation
            </button>
          </div>
        )}

        {(canConfirmDelivered || (order.status === 'CREATED' && buyer) || (canDispute && !showDisputeForm)) && (
          <div className="order__actions">
            {canConfirmDelivered && (
              <button className="btn" disabled={busy} onClick={() => run(() => api.confirmDelivered(order.id, 'BUYER'))}>
                I've received this order
              </button>
            )}

            {order.status === 'CREATED' && buyer && (
              <button
                className="btn btn--outline"
                disabled={busy}
                onClick={() => run(() => api.cancelOrder(order.id, buyer.id))}
              >
                Cancel order
              </button>
            )}

            {canDispute && !showDisputeForm && (
              <button className="btn btn--outline" onClick={() => setShowDisputeForm(true)}>
                Report a problem
              </button>
            )}
          </div>
        )}

        {showDisputeForm && (
          <div className="dispute">
            <div className="field">
              <label htmlFor="reason">What went wrong?</label>
              <textarea
                id="reason"
                rows={3}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="e.g. the item doesn't match the listing"
              />
            </div>
            <div className="row">
              <button
                className="btn btn--danger"
                disabled={busy || !disputeReason.trim() || !buyer}
                onClick={() =>
                  run(async () => {
                    await api.openDispute(payment.id, buyer!.id, disputeReason.trim());
                    setShowDisputeForm(false);
                    setDisputeReason('');
                  })
                }
              >
                Open dispute and freeze the payment
              </button>
              <button className="btn btn--outline" onClick={() => setShowDisputeForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {payment.protectionStatus === 'PROTECTED' && (
          <p className="muted" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
            Your payment stays protected until delivery is confirmed. After that, a short protection window runs
            before the seller is paid.
          </p>
        )}
      </div>
    </div>
  );
}
