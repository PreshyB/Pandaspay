import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Order, Payment } from '../api/types';
import { StatusBadges } from '../components/StatusBadges';
import { useAccount } from '../lib/account';
import { formatMoney } from '../lib/money';

type OrderWithPayment = Order & { payment: Payment };

export default function MyOrdersPage() {
  const { user, loading } = useAccount();
  const [orders, setOrders] = useState<OrderWithPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .listOrdersForBuyer(user.id)
      .then(setOrders)
      .catch(() => setError('Could not load your orders.'));
  }, [user]);

  if (loading) return <p className="muted">Loading…</p>;

  if (!user) {
    return (
      <div className="card empty">
        <h1>Your orders</h1>
        <p>Create a free account to see the orders you've paid for and track each one.</p>
        <Link className="btn" to="/get-started?role=buyer">
          Get started
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>My orders</h1>
        <p className="muted" style={{ margin: 0 }}>
          {user.fullName}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      {orders && orders.length === 0 && (
        <div className="card empty">
          <h2>No orders yet</h2>
          <p>When you pay for a product from a seller's link, it shows up here.</p>
          <Link className="btn" to="/#find">
            Enter a product code
          </Link>
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="orders">
          {orders.map((order) => (
            <div key={order.id} className="orders__row">
              <div>
                <Link to={`/orders/${order.id}`} className="mono link">
                  {order.id.slice(0, 8)}…
                </Link>
                <div className="orders__total">{formatMoney(order.totalMinor, order.currency)}</div>
              </div>
              <StatusBadges orderStatus={order.status} paymentStatus={order.payment.protectionStatus} />
              <div className="orders__actions">
                <Link className="btn btn--outline" to={`/orders/${order.id}`}>
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
