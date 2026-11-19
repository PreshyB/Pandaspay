import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Dispute, Order, Payment } from '../api/types';
import { DeliveryTracking } from '../components/DeliveryTracking';
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
  const [disputeDetails, setDisputeDetails] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [sellerReply, setSellerReply] = useState('');

  const { user: buyer } = useDevIdentity('buyer');

  const refresh = useCallback(() => {
    api
      .getOrder(orderId)
      .then((o) => {
        setOrder(o);
        if (o.payment.protectionStatus === 'DISPUTED') {
          api.getDisputeForPayment(o.payment.id).then(setDispute).catch(() => setDispute(null));
        } else {
          setDispute(null);
        }
      })
      .catch(() => setError('Could not load this order.'));
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
  const viewerIsSeller = !!buyer && buyer.id === order.sellerId;
  const waiting = payment.protectionStatus === 'AWAITING_PAYMENT' && order.status === 'CREATED';

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
        {waiting && (
          <p>
            <button className="btn btn--outline" disabled={busy} onClick={() => run(async () => undefined)}>
              Check status now
            </button>
          </p>
        )}

        <div className="order__badges">
          <StatusBadges orderStatus={order.status} paymentStatus={payment.protectionStatus} />
        </div>

        <DeliveryTracking order={order} />

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

        {!viewerIsSeller && (canConfirmDelivered || (order.status === 'CREATED' && buyer) || (canDispute && !showDisputeForm)) && (
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
              <select id="reason" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)}>
                <option value="">Choose a reason</option>
                <option>Item not received</option>
                <option>Item not as described</option>
                <option>Item damaged</option>
                <option>Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="details">
                Tell us more <span className="field__hint">(optional)</span>
              </label>
              <textarea
                id="details"
                rows={3}
                value={disputeDetails}
                onChange={(e) => setDisputeDetails(e.target.value)}
                placeholder="What happened, and what would put it right?"
              />
            </div>
            <div className="row">
              <button
                className="btn btn--danger"
                disabled={busy || !disputeReason.trim() || !buyer}
                onClick={() =>
                  run(async () => {
                    await api.openDispute(payment.id, buyer!.id, disputeReason.trim(), disputeDetails.trim() || undefined);
                    setShowDisputeForm(false);
                    setDisputeReason('');
                    setDisputeDetails('');
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

        {dispute && payment.protectionStatus === 'DISPUTED' && (
          <section className="dispute-panel" aria-label="Dispute">
            <h2>Dispute under review</h2>
            <p>
              <strong>{dispute.reason}</strong>
              {dispute.details && <> — {dispute.details}</>}
            </p>
            {dispute.sellerRespondedAt ? (
              <p>
                <strong>Seller's response:</strong> {dispute.sellerResponse}
              </p>
            ) : dispute.sellerResponseDueAt ? (
              <p className="muted">
                {viewerIsSeller ? 'Please respond by ' : 'The seller has until '}
                <strong>{new Date(dispute.sellerResponseDueAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</strong> to respond.
                The window length is provisional.
              </p>
            ) : null}
            <p className="muted">The payment stays protected and on hold until PayTight reviews both sides and decides.</p>
            {viewerIsSeller && !dispute.sellerRespondedAt && (
              <div className="field">
                <label htmlFor="reply">Your response</label>
                <textarea
                  id="reply"
                  rows={3}
                  value={sellerReply}
                  onChange={(e) => setSellerReply(e.target.value)}
                  placeholder="What happened from your side? Mention the waybill, delivery date or anything that helps."
                />
                <button
                  className="btn"
                  style={{ marginTop: '0.5rem' }}
                  disabled={busy || sellerReply.trim().length < 5}
                  onClick={() =>
                    run(async () => {
                      await api.respondToDispute(dispute.id, sellerReply.trim(), buyer!.id);
                      setSellerReply('');
                    })
                  }
                >
                  Send response
                </button>
              </div>
            )}
          </section>
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
