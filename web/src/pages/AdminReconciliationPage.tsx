import { useEffect, useState } from 'react';
import { getReconciliation, type Reconciliation } from '../api/users';
import { formatMoney } from '../lib/money';

export default function AdminReconciliationPage() {
  const [r, setR] = useState<Reconciliation | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getReconciliation()
      .then(setR)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not run the check.'));
  }, []);

  return (
    <div>
      <div className="page-head">
        <h1>Reconciliation</h1>
        <p className="muted" style={{ margin: 0 }}>
          Checks that payment statuses, payout and refund instructions, and the ledger agree.
        </p>
      </div>
      <div className="notice notice--amber">
        This compares BuyBridge's own records only. It can't yet compare with the payment partner's statement, because no partner is
        connected. Payments made before the ledger existed will show as mismatches.
      </div>
      {error && <p className="error">{error}</p>}
      {!r && !error && <p className="muted">Checking…</p>}
      {r && (
        <>
          <div className="fundtiles" style={{ marginTop: '1rem' }}>
            {(
              [
                ['Received', r.totals.receivedMinor],
                ['Payouts instructed', r.totals.payoutInstructedMinor],
                ['Refunds instructed', r.totals.refundInstructedMinor],
                ['Still held by partner', r.totals.stillHeldMinor],
              ] as Array<[string, string]>
            ).map(([t, v]) => (
              <div key={t} className="fundtile">
                <p className="fundtile__t">{t}</p>
                <p className="fundtile__v">{formatMoney(v, 'NGN')}</p>
              </div>
            ))}
          </div>
          <section className="panel" style={{ marginTop: '1rem' }}>
            <h2>{r.clean ? `All ${r.checkedPayments} payments agree` : `${r.issues.length} mismatch${r.issues.length === 1 ? '' : 'es'}`}</h2>
            {r.issues.length > 0 && (
              <ul className="co__opts">
                {r.issues.map((i, n) => (
                  <li key={n}>
                    <span className="mono">{i.paymentId.slice(0, 8)}…</span> {i.problem}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
