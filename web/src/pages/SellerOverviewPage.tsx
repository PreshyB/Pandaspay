import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadges } from '../components/StatusBadges';
import { payoutsApi, type FundsSummary } from '../api/users';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';
import { isDisputed, isOnTheWay, needsAccept, needsShipping, useSellerOrders, type SellerOrder } from '../lib/useSellerOrders';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

function lastDays(orders: SellerOrder[], n: number) {
  const days: Array<{ label: string; count: number }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    days.push({
      label: d.toLocaleDateString('en-NG', { weekday: 'short' }),
      count: orders.filter((o) => new Date(o.createdAt) >= d && new Date(o.createdAt) < next).length,
    });
  }
  return days;
}

function actionFor(o: SellerOrder): { label: string; hint: string; tone: 'alert' | 'amber' | 'primary' } {
  if (isDisputed(o)) return { label: 'Respond', hint: 'Dispute open. Reply with your side.', tone: 'alert' };
  if (needsAccept(o)) return { label: 'Review', hint: 'Paid and waiting for you to accept.', tone: 'amber' };
  return { label: 'Ship', hint: 'Accepted. Add a waybill to ship it.', tone: 'primary' };
}

export default function SellerOverviewPage() {
  const { user: seller } = useDevIdentity('seller');
  const { orders, error } = useSellerOrders(seller?.id);
  const [funds, setFunds] = useState<FundsSummary | null>(null);

  useEffect(() => {
    if (seller) payoutsApi.summary(seller.id).then(setFunds).catch(() => setFunds(null));
  }, [seller]);

  if (!seller) return null;
  const list = orders ?? [];
  const queue = list.filter((o) => isDisputed(o) || needsAccept(o) || needsShipping(o));
  const days = lastDays(list, 7);
  const peak = Math.max(1, ...days.map((d) => d.count));
  const cur = funds?.currency ?? 'NGN';
  const money = (v?: string) => (v === undefined ? '—' : formatMoney(v, cur));

  return (
    <div>
      <header className="sd__head">
        <div>
          <h1>
            {greeting()}, {seller.fullName.split(' ')[0]}
          </h1>
          <p className="muted">Here is what needs you today and how your sales are doing.</p>
        </div>
        <Link className="btn btn--outline" to="/seller/orders">
          All orders
        </Link>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="kpis" aria-label="Key numbers">
        <div className="kpi kpi--lead">
          <span className="kpi__l">Ready to withdraw</span>
          <strong className="kpi__v">{money(funds?.eligibleMinor)}</strong>
          <Link className="link" to="/seller/funds">Request a payout</Link>
        </div>
        <div className="kpi">
          <span className="kpi__l">Protected, awaiting delivery</span>
          <strong className="kpi__v">{money(funds?.pendingSettlementMinor)}</strong>
          <span className="kpi__s">Released after the buyer confirms</span>
        </div>
        <div className="kpi">
          <span className="kpi__l">On hold (disputes)</span>
          <strong className="kpi__v">{money(funds?.onHoldMinor)}</strong>
          <span className="kpi__s">{list.filter(isDisputed).length} open</span>
        </div>
        <div className="kpi">
          <span className="kpi__l">Paid out so far</span>
          <strong className="kpi__v">{money(funds?.paidOutMinor)}</strong>
          <span className="kpi__s">{list.filter(isOnTheWay).length} on the way to buyers</span>
        </div>
      </section>

      <div className="sd__cols">
        <section className="panel" aria-labelledby="queue-h">
          <div className="panel__head">
            <h2 id="queue-h">Needs your attention</h2>
            <span className="count">{queue.length}</span>
          </div>
          {orders === null ? (
            <p className="muted panel__pad">Loading…</p>
          ) : queue.length === 0 ? (
            <p className="muted panel__pad">You're all caught up. New paid orders will show up here.</p>
          ) : (
            <ul className="queue">
              {queue.slice(0, 8).map((o) => {
                const a = actionFor(o);
                return (
                  <li key={o.id} className="queue__row">
                    <span className={`dot dot--${a.tone}`} aria-hidden="true" />
                    <div className="queue__main">
                      <strong>
                        {formatMoney(o.totalMinor, o.currency)} <span className="mono muted">· {o.id.slice(0, 8)}</span>
                      </strong>
                      <span className="muted">{a.hint}</span>
                    </div>
                    <Link className="btn btn--sm" to={isDisputed(o) ? `/orders/${o.id}` : '/seller/orders'}>
                      {a.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="week-h">
          <div className="panel__head">
            <h2 id="week-h">Orders this week</h2>
            <span className="count">{days.reduce((n, d) => n + d.count, 0)}</span>
          </div>
          <div className="bars" role="img" aria-label={`Orders per day: ${days.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
            {days.map((d) => (
              <div key={d.label + d.count} className="bars__col">
                <span className="bars__n">{d.count || ''}</span>
                <span className="bars__bar" style={{ height: `${(d.count / peak) * 100}%` }} />
                <span className="bars__l">{d.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel" aria-labelledby="recent-h">
        <div className="panel__head">
          <h2 id="recent-h">Recent orders</h2>
          <Link className="link" to="/seller/orders">View all</Link>
        </div>
        {orders !== null && list.length === 0 ? (
          <div className="panel__pad empty-state">
            <h3>No orders yet</h3>
            <p className="muted">List a product, then share its link in your chats or posts. Orders appear here once a buyer pays.</p>
            <Link className="btn" to="/seller/new-product">List a product</Link>
          </div>
        ) : (
          <ul className="queue">
            {list.slice(0, 5).map((o) => (
              <li key={o.id} className="queue__row">
                <div className="queue__main">
                  <Link className="mono link" to={`/orders/${o.id}`}>{o.id.slice(0, 8)}</Link>
                  <span className="muted">{new Date(o.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
                </div>
                <StatusBadges orderStatus={o.status} paymentStatus={o.payment.protectionStatus} />
                <strong>{formatMoney(o.totalMinor, o.currency)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
