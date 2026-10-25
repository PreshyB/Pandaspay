import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Order, Payment } from '../api/types';
import { StatusBadges } from '../components/StatusBadges';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';

type OrderWithPayment = Order & { payment: Payment };

export default function SellerDashboardPage() {
  const { user: seller, loading: identityLoading, createIdentity } = useDevIdentity('seller');
  const [orders, setOrders] = useState<OrderWithPayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [waybillDrafts, setWaybillDrafts] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const refresh = useCallback(() => {
    if (!seller) return;
    api.listOrdersForSeller(seller.id).then(setOrders).catch(() => setError('Could not load orders.'));
  }, [seller]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run(orderId: string, action: () => Promise<unknown>) {
    setBusyId(orderId);
    setError(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That action failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (identityLoading) return <p className="muted">Loading…</p>;

  if (!seller) {
    return (
      <div>
        <h1>Seller dashboard</h1>
        <p>Sign in with the dev identity you used when listing a product (or create one here).</p>
        <div className="card">
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">Your email</label>
            <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn" disabled={!name || !email} onClick={() => createIdentity({ email, fullName: name })}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Orders</h1>
      <p className="muted">{seller.fullName}</p>
      {error && <p className="error">{error}</p>}

      {orders.length === 0 && <p className="muted">No orders yet.</p>}

      <div className="order-list">
        {orders.map((order) => {
          const canAccept = order.status === 'CREATED' && order.payment.protectionStatus !== 'AWAITING_PAYMENT';
          const canShip = order.status === 'PREPARING';
          const busy = busyId === order.id;

          return (
            <div key={order.id} className="card order-list__item">
              <div>
                <Link to={`/orders/${order.id}`} className="mono" style={{ color: 'var(--primary)' }}>
                  {order.id.slice(0, 8)}…
                </Link>
                <div style={{ marginTop: '0.5rem' }}>
                  <StatusBadges orderStatus={order.status} paymentStatus={order.payment.protectionStatus} />
                </div>
                <p className="muted" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                  {formatMoney(order.totalMinor, order.currency)}
                </p>
              </div>

              <div className="row">
                {canAccept && (
                  <button className="btn btn--secondary" disabled={busy} onClick={() => run(order.id, () => api.acceptOrder(order.id))}>
                    Accept
                  </button>
                )}
                {order.status === 'CREATED' && (
                  <button
                    className="btn btn--outline"
                    disabled={busy}
                    onClick={() => run(order.id, () => api.declineOrder(order.id, seller.id))}
                  >
                    Decline
                  </button>
                )}
                {canShip && (
                  <>
                    <input
                      placeholder="Waybill ref"
                      value={waybillDrafts[order.id] ?? ''}
                      onChange={(e) => setWaybillDrafts((d) => ({ ...d, [order.id]: e.target.value }))}
                      style={{
                        border: '1px solid var(--line-strong)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.5rem 0.625rem',
                        fontSize: '0.875rem',
                      }}
                    />
                    <button
                      className="btn"
                      disabled={busy || !waybillDrafts[order.id]}
                      onClick={() => run(order.id, () => api.shipOrder(order.id, waybillDrafts[order.id]))}
                    >
                      Mark shipped
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
