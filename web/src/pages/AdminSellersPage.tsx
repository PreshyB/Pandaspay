import { useCallback, useEffect, useState } from 'react';
import { listSellerApplications, reviewSeller, type User } from '../api/users';

export default function AdminSellersPage() {
  const [apps, setApps] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    listSellerApplications('PENDING')
      .then(setApps)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load applications.'));
  }, []);

  useEffect(load, [load]);

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusy(id);
    setError(null);
    try {
      await reviewSeller(id, decision, reason);
      setRejecting(null);
      setReason('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That decision could not be saved.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Seller applications</h1>
        <p className="muted" style={{ margin: 0 }}>
          Approving adds seller tools to the person's existing account.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      {!apps && !error && <p className="muted">Loading…</p>}
      {apps && apps.length === 0 && (
        <div className="card empty">
          <h2>No applications waiting</h2>
          <p>New seller applications show up here.</p>
        </div>
      )}
      {apps?.map((u) => (
        <section key={u.id} className="panel" style={{ marginBottom: '1rem' }}>
          <h2>{u.sellerApplication?.businessName ?? u.fullName}</h2>
          <p className="muted">
            {u.fullName} · {u.email}
            {u.storeState && (
              <>
                {' '}
                · ships from {u.storeCity ? `${u.storeCity}, ` : ''}
                {u.storeState}
              </>
            )}
          </p>
          {u.sellerApplication?.socialLink && <p>Page: {u.sellerApplication.socialLink}</p>}
          {u.sellerApplication?.note && <p>"{u.sellerApplication.note}"</p>}
          {rejecting === u.id ? (
            <div className="field">
              <label htmlFor={`r-${u.id}`}>Reason (the applicant will see this)</label>
              <textarea id={`r-${u.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="row" style={{ marginTop: '0.5rem' }}>
                <button className="btn btn--danger" disabled={busy === u.id || reason.trim().length < 5} onClick={() => decide(u.id, 'reject')}>
                  Reject application
                </button>
                <button className="btn btn--outline" onClick={() => setRejecting(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="row">
              <button className="btn" disabled={busy === u.id} onClick={() => decide(u.id, 'approve')}>
                Approve
              </button>
              <button className="btn btn--outline" onClick={() => setRejecting(u.id)}>
                Reject
              </button>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
