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
      <div style={{ maxWidth: '30rem' }}>
        <div className="page-head">
          <h1>Set up your seller profile</h1>
          <p>
            Add your name and email to start receiving orders. This test profile is saved in this browser
            only.
          </p>
        </div>
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="email">Your email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <button className="btn btn--lg" disabled={!name || !email} onClick={() => createIdentity({ email, fullName: name })}>
          Create profile
        </button>
      </div>
    );
  }

  const toAccept = orders.filter((o) => o.status === 'CREATED' && o.payment.protectionStatus !== 'AWAITING_PAYMENT').length;
  const toShip = orders.filter((o) => o.status === 'PREPARING').length;
  const onTheWay = orders.filter((o) => o.status === 'SHIPPED' || o.status === 'IN_TRANSIT').length;
  const paidOut = orders.filter((o) => o.payment.protectionStatus === 'RELEASED').length;

  return (
    <div>
      <div className="page-head">
        <h1>Orders</h1>
        <p className="muted" style={{ margin: 0 }}>
          {seller.fullName}
        </p>
      </div>

      <dl className="tally">
        {(
          [
            ['To accept', toAccept],
            ['To ship', toShip],
            ['On the way', onTheWay],
            ['Paid out', paidOut],
          ] as Array<[string, number]>
        ).map(([label, count]) => (
          <div key={label} className="tally__item">
            <dt className="tally__l">{label}</dt>
            <dd className="tally__n">{count}</dd>
          </div>
        ))}
      </dl>

      {error && <p className="error">{error}</p>}

      {orders.length === 0 ? (
        <div className="card empty">
          <h2>No orders yet</h2>
          <p>Orders appear here as soon as a buyer pays from one of your product links.</p>
          <Link className="btn" to="/seller/new-product">
            List a product
          </Link>
        </div>
      ) : (
        <div className="orders">
          {orders.map((order) => {
            const canAccept = order.status === 'CREATED' && order.payment.protectionStatus !== 'AWAITING_PAYMENT';
            const canShip = order.status === 'PREPARING';
            const busy = busyId === order.id;

            return (
              <div key={order.id} className="orders__row">
                <div>
                  <Link to={`/orders/${order.id}`} className="mono link">
                    {order.id.slice(0, 8)}…
                  </Link>
                  <div className="orders__total">{formatMoney(order.totalMinor, order.currency)}</div>
                </div>

                <StatusBadges orderStatus={order.status} paymentStatus={order.payment.protectionStatus} />

                <div className="orders__actions">
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
                        className="input input--sm"
                        aria-label={`Waybill reference for order ${order.id.slice(0, 8)}`}
                        placeholder="Waybill reference"
                        value={waybillDrafts[order.id] ?? ''}
                        onChange={(e) => setWaybillDrafts((d) => ({ ...d, [order.id]: e.target.value }))}
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
      )}
    </div>
  );
}
