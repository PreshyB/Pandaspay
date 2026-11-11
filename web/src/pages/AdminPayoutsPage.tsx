import { useCallback, useEffect, useState } from 'react';
import { payoutsApi, type PayoutRequestRow } from '../api/users';
import { formatMoney } from '../lib/money';

export default function AdminPayoutsPage() {
  const [rows, setRows] = useState<PayoutRequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(() => {
    payoutsApi
      .list('REQUESTED')
      .then(setRows)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load requests.'));
  }, []);
  useEffect(load, [load]);

  async function act(id: string, kind: 'approve' | 'reject') {
    setBusy(id);
    setError(null);
    try {
      if (kind === 'approve') await payoutsApi.approve(id);
      else await payoutsApi.reject(id, reason);
      setConfirm(null);
      setRejecting(null);
      setReason('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That could not be saved.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Payout requests</h1>
        <p className="muted" style={{ margin: 0 }}>
          Approving sends the payout instruction to the payment partner. Payments disputed since the request are left out automatically.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      {!rows && !error && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && (
        <div className="card empty">
          <h2>No payout requests waiting</h2>
        </div>
      )}
      {rows?.map((r) => (
        <section key={r.id} className="panel" style={{ marginBottom: '1rem' }}>
          <h2>{formatMoney(r.amountMinor, r.currency)}</h2>
          <p className="muted">
            {r.paymentIds.length} payment{r.paymentIds.length === 1 ? '' : 's'} · seller <span className="mono">{r.sellerId.slice(0, 8)}…</span>
          </p>
          <p>
            To <strong>{r.destination.accountName}</strong>, {r.destination.bankName} ••••{r.destination.accountNumber.slice(-4)}
          </p>
          {rejecting === r.id ? (
            <div className="field">
              <label htmlFor={`rr-${r.id}`}>Reason (the seller will see this)</label>
              <textarea id={`rr-${r.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="row" style={{ marginTop: '0.5rem' }}>
                <button className="btn btn--danger" disabled={busy === r.id || reason.trim().length < 5} onClick={() => act(r.id, 'reject')}>
                  Reject request
                </button>
                <button className="btn btn--outline" onClick={() => setRejecting(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : confirm === r.id ? (
            <div className="notice notice--amber">
              <strong>Confirm:</strong> send {formatMoney(r.amountMinor, r.currency)} to {r.destination.accountName}. This can't be undone.
              <div className="row" style={{ marginTop: '0.75rem' }}>
                <button className="btn" disabled={busy === r.id} onClick={() => act(r.id, 'approve')}>
                  {busy === r.id ? 'Sending…' : 'Confirm payout'}
                </button>
                <button className="btn btn--outline" onClick={() => setConfirm(null)}>
                  Go back
                </button>
              </div>
            </div>
          ) : (
            <div className="row">
              <button className="btn" onClick={() => setConfirm(r.id)}>
                Approve
              </button>
              <button className="btn btn--outline" onClick={() => setRejecting(r.id)}>
                Reject
              </button>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
