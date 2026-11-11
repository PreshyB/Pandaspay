import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Dispute } from '../api/types';
import { formatMoney } from '../lib/money';

export const DISPUTE_LABEL: Record<Dispute['status'], string> = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under review',
  RESOLVED_SELLER: 'Resolved: seller',
  RESOLVED_BUYER: 'Resolved: buyer refunded',
  RESOLVED_SPLIT: 'Resolved: split',
};

export const ageOf = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 1 ? 'Under 1 hr' : h < 48 ? `${h} hrs` : `${Math.floor(h / 24)} days`;
};

export function AdminBanner() {
  return (
    <div className="notice notice--amber">
      <strong>Admins only.</strong> Decisions here are recorded in the audit log. When the server runs in test mode without enforced
      sign-in, these screens are open to anyone with the link, so turn enforcement on before real money moves.
    </div>
  );
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listDisputes()
      .then(setDisputes)
      .catch(() => setError('Could not load disputes.'));
  }, []);

  const open = (disputes ?? []).filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW');
  const done = (disputes ?? []).filter((d) => !(d.status === 'OPEN' || d.status === 'UNDER_REVIEW'));
  const shown = tab === 'open' ? open : done;

  return (
    <div>
      <div className="page-head">
        <h1>Disputes</h1>
        <p className="muted" style={{ margin: 0 }}>
          Payments frozen because a buyer reported a problem.
        </p>
      </div>
      <AdminBanner />

      <div className="tabs" role="tablist" aria-label="Dispute filter">
        <button role="tab" aria-selected={tab === 'open'} className="tabs__t" onClick={() => setTab('open')}>
          Needs a decision ({open.length})
        </button>
        <button role="tab" aria-selected={tab === 'done'} className="tabs__t" onClick={() => setTab('done')}>
          Resolved ({done.length})
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {!disputes && !error && <p className="muted">Loading…</p>}

      {disputes && shown.length === 0 && (
        <div className="card empty">
          <h2>{tab === 'open' ? 'No disputes waiting' : 'Nothing resolved yet'}</h2>
          <p>{tab === 'open' ? 'When a buyer reports a problem, it appears here.' : 'Decided disputes show up here.'}</p>
        </div>
      )}

      {shown.length > 0 && (
        <div className="orders">
          {shown.map((d) => (
            <div key={d.id} className="orders__row">
              <div>
                <Link className="mono link" to={`/admin/disputes/${d.id}`}>
                  {(d.order?.id ?? d.paymentId).slice(0, 8)}…
                </Link>
                <div className="orders__total">{d.payment ? formatMoney(d.payment.amountMinor, d.payment.currency) : ''}</div>
              </div>
              <div>
                <strong>{d.reason}</strong>
                <p className="muted" style={{ margin: 0 }}>
                  Opened {ageOf(d.createdAt)} ago · {DISPUTE_LABEL[d.status]}
                </p>
              </div>
              <div className="orders__actions">
                <Link className="btn btn--outline" to={`/admin/disputes/${d.id}`}>
                  {tab === 'open' ? 'Review' : 'View'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
