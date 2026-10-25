import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Order, Payment } from '../api/types';
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

  if (error && !order) return <p className="error">{error}</p>;
  if (!order) return <p className="muted">Loading order…</p>;

  const { payment } = order;
  const canSimulatePayment = payment.protectionStatus === 'AWAITING_PAYMENT' && payment.providerTransactionRef;
  const canConfirmDelivered = order.status === 'SHIPPED' || order.status === 'IN_TRANSIT';
  const canDispute = payment.protectionStatus === 'PROTECTED' || payment.protectionStatus === 'RELEASABLE';

  return (
    <div>
      <h1>Order</h1>
      <p className="mono">{order.id}</p>

      <div className="card">
        <StatusBadges orderStatus={order.status} paymentStatus={payment.protectionStatus} />

        <div style={{ marginTop: '1.5rem' }}>
          <strong style={{ fontSize: '1.125rem' }}>{formatMoney(order.totalMinor, order.currency)}</strong>
          <p className="muted">
            {order.items.length} item{order.items.length === 1 ? '' : 's'}
          </p>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="row" style={{ marginTop: '1.25rem' }}>
          {canSimulatePayment && (
            <button
              className="btn btn--secondary"
              disabled={busy}
              onClick={() => run(() => api.simulatePaymentConfirmed(payment.providerTransactionRef!))}
            >
              Simulate PalmPay payment confirmation
            </button>
          )}

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

        {showDisputeForm && (
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--line)', paddingTop: '1.25rem' }}>
            <div className="field">
              <label htmlFor="reason">What went wrong?</label>
              <textarea
                id="reason"
                rows={3}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="e.g. item doesn't match the listing"
              />
            </div>
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
              Open dispute — freezes the payment
            </button>
          </div>
        )}

        {payment.protectionStatus === 'PROTECTED' && (
          <p className="muted" style={{ marginTop: '1.25rem' }}>
            Your payment is protected according to the transaction terms. It stays protected until delivery is
            confirmed, then a short protection window before the seller is paid.
          </p>
        )}
      </div>
    </div>
  );
}
