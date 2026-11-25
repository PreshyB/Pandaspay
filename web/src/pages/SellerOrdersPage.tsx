import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { StatusBadges } from '../components/StatusBadges';
import { snapshotLabel } from '../lib/delivery';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';
import { isDisputed, isDone, isOnTheWay, needsAccept, needsShipping, useSellerOrders, type SellerOrder } from '../lib/useSellerOrders';

type Tab = 'all' | 'accept' | 'ship' | 'way' | 'disputed' | 'done';
const TABS: Array<{ id: Tab; label: string; test: (o: SellerOrder) => boolean }> = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'accept', label: 'To accept', test: needsAccept },
  { id: 'ship', label: 'To ship', test: needsShipping },
  { id: 'way', label: 'On the way', test: isOnTheWay },
  { id: 'disputed', label: 'Disputes', test: isDisputed },
  { id: 'done', label: 'Completed', test: isDone },
];

export default function SellerOrdersPage() {
  const { user: seller } = useDevIdentity('seller');
  const { orders, error, refresh } = useSellerOrders(seller?.id);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [waybills, setWaybills] = useState<Record<string, string>>({});

  const list = orders ?? [];
  const shown = useMemo(() => {
    const test = TABS.find((t) => t.id === tab)!.test;
    const needle = q.trim().toLowerCase();
    return list.filter((o) => test(o) && (!needle || o.id.toLowerCase().includes(needle)));
  }, [list, tab, q]);

  async function run(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'That action failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (!seller) return null;

  return (
    <div>
      <header className="sd__head">
        <div>
          <h1>Orders</h1>
          <p className="muted">Accept, ship and follow every order from one place.</p>
        </div>
      </header>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Order filters">
          {TABS.map((t) => {
            const n = list.filter(t.test).length;
            return (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tabs__tab${tab === t.id ? ' tabs__tab--on' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
                <span className="tabs__n">{n}</span>
              </button>
            );
          })}
        </div>
        <input className="toolbar__search" type="search" placeholder="Search by order number" aria-label="Search orders" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {(error || actionError) && <p className="error">{actionError ?? error}</p>}

      <div className="panel">
        {orders === null ? (
          <p className="muted panel__pad">Loading…</p>
        ) : shown.length === 0 ? (
          <div className="panel__pad empty-state">
            <h3>{list.length === 0 ? 'No orders yet' : 'Nothing here'}</h3>
            <p className="muted">
              {list.length === 0 ? 'Orders appear as soon as a buyer pays from one of your product links.' : 'No orders match this filter.'}
            </p>
            {list.length === 0 && (
              <Link className="btn" to="/seller/new-product">
                List a product
              </Link>
            )}
          </div>
        ) : (
          <table className="dt">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th className="dt__num">Total</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => {
                const busy = busyId === o.id;
                const expanded = open === o.id;
                const addr = o.deliveryAddress;
                return (
                  <Fragment key={o.id}>
                    <tr className={expanded ? 'dt__open' : undefined}>
                      <td data-label="Order">
                        <button className="dt__expand" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : o.id)}>
                          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                          <span className="mono">{o.id.slice(0, 8)}</span>
                        </button>
                      </td>
                      <td data-label="Date">{new Date(o.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td data-label="Status">
                        <StatusBadges orderStatus={o.status} paymentStatus={o.payment.protectionStatus} />
                      </td>
                      <td data-label="Total" className="dt__num">
                        {formatMoney(o.totalMinor, o.currency)}
                      </td>
                      <td className="dt__actions">
                        {needsAccept(o) && (
                          <>
                            <button className="btn btn--sm btn--secondary" disabled={busy} onClick={() => run(o.id, () => api.acceptOrder(o.id))}>
                              Accept
                            </button>
                            <button className="btn btn--sm btn--outline" disabled={busy} onClick={() => run(o.id, () => api.declineOrder(o.id, seller.id))}>
                              Decline
                            </button>
                          </>
                        )}
                        {isDisputed(o) && (
                          <Link className="btn btn--sm btn--danger" to={`/orders/${o.id}`}>
                            Respond
                          </Link>
                        )}
                        {needsShipping(o) && !expanded && (
                          <button className="btn btn--sm" onClick={() => setOpen(o.id)}>
                            Ship
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="dt__detail">
                        <td colSpan={5}>
                          <div className="detail">
                            <div>
                              <h3>Delivery</h3>
                              {o.status === 'CREATED' ? (
                                <p className="muted">
                                  Ships to {[addr?.city, addr?.state].filter(Boolean).join(', ') || 'the buyer’s address'}. The buyer's name, phone and street are shown once you accept.
                                </p>
                              ) : addr?.street ? (
                                <p>
                                  {addr.recipientName}, {addr.phone}
                                  <br />
                                  {addr.street}, {addr.city}, {addr.state}
                                  {o.deliveryOption && (
                                    <>
                                      <br />
                                      <span className="muted">{snapshotLabel(o.deliveryOption)}</span>
                                    </>
                                  )}
                                </p>
                              ) : (
                                <p className="muted">No address on this order.</p>
                              )}
                            </div>
                            <div>
                              <h3>Items</h3>
                              <p>
                                {o.items.map((i) => `${i.quantity} × ${Object.values(i.variant ?? {}).join(' / ') || 'item'}`).join(', ')}
                              </p>
                              <Link className="link" to={`/orders/${o.id}`}>
                                Full order details
                              </Link>
                            </div>
                            {needsShipping(o) && (
                              <div>
                                <h3>Mark as shipped</h3>
                                <div className="row">
                                  <input
                                    className="input input--sm"
                                    aria-label={`Waybill reference for order ${o.id.slice(0, 8)}`}
                                    placeholder="Waybill reference"
                                    value={waybills[o.id] ?? ''}
                                    onChange={(e) => setWaybills((d) => ({ ...d, [o.id]: e.target.value }))}
                                  />
                                  <button className="btn btn--sm" disabled={busy || !waybills[o.id]} onClick={() => run(o.id, () => api.shipOrder(o.id, waybills[o.id]))}>
                                    Mark shipped
                                  </button>
                                </div>
                                <p className="gs__fine">A waybill number alone isn't proof of delivery. If there's a dispute, the courier's records or other evidence will be needed.</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
