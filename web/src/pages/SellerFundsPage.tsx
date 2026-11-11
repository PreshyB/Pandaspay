import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { payoutsApi, type FundsSummary, type PayoutAccountInfo, type PayoutRequestRow } from '../api/users';
import { useDevIdentity } from '../lib/useDevIdentity';
import { formatMoney } from '../lib/money';

const BUCKET: Record<string, string> = {
  PENDING_SETTLEMENT: 'Pending settlement',
  ON_HOLD: 'On hold (dispute)',
  ELIGIBLE: 'Eligible for payout',
  PAYOUT_REQUESTED: 'Payout requested',
  PAID_OUT: 'Paid out',
  REFUNDED: 'Refunded to buyer',
};

export default function SellerFundsPage() {
  const { user: seller, loading } = useDevIdentity('seller');
  const [sum, setSum] = useState<FundsSummary | null>(null);
  const [acct, setAcct] = useState<PayoutAccountInfo | null | undefined>(undefined);
  const [reqs, setReqs] = useState<PayoutRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bank, setBank] = useState('');
  const [name, setName] = useState('');
  const [num, setNum] = useState('');

  const load = useCallback(() => {
    if (!seller) return;
    Promise.all([payoutsApi.summary(seller.id), payoutsApi.account(seller.id), payoutsApi.mine(seller.id)])
      .then(([s, a, r]) => {
        setSum(s);
        setAcct(a);
        setReqs(r);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load this page.'));
  }, [seller]);

  useEffect(load, [load]);

  if (loading) return <p className="muted">Loading…</p>;
  if (!seller) {
    return (
      <div className="card empty">
        <h1>Sales and payouts</h1>
        <p>Seller tools switch on once your seller application is approved.</p>
        <Link className="btn" to="/start-selling">
          Start selling
        </Link>
      </div>
    );
  }

  async function saveAccount(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setAcct(await payoutsApi.saveAccount(seller!.id, { bankName: bank, accountName: name, accountNumber: num }));
      setEditing(false);
      setNum('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the account.');
    } finally {
      setBusy(false);
    }
  }

  async function requestPayout() {
    setBusy(true);
    setError(null);
    try {
      await payoutsApi.request(seller!.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request a payout.');
    } finally {
      setBusy(false);
    }
  }

  const cur = sum?.currency ?? 'NGN';
  const money = (v: string) => formatMoney(v, cur);
  const eligible = sum ? BigInt(sum.eligibleMinor) > BigInt(0) : false;
  const tiles: Array<[string, string, string]> = sum
    ? [
        ['Pending settlement', sum.pendingSettlementMinor, 'Paid by buyers, not yet eligible. Released after delivery is confirmed or the protection window passes.'],
        ['Eligible for payout', sum.eligibleMinor, 'Ready for you to request.'],
        ['Payout requested', sum.payoutRequestedMinor, 'Waiting for BuyBridge to approve.'],
        ['Paid out', sum.paidOutMinor, 'Sent to your bank account.'],
        ['On hold', sum.onHoldMinor, 'A buyer opened a dispute on these.'],
      ]
    : [];

  return (
    <div>
      <div className="page-head">
        <h1>Sales and payouts</h1>
        <p className="muted" style={{ margin: 0 }}>
          This is a view of your sales, not a wallet. Payments are held by BuyBridge's licensed payment partner until they're released.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      {!sum && !error && <p className="muted">Loading…</p>}

      {sum && (
        <>
          <div className="fundtiles">
            {tiles.map(([t, v, d]) => (
              <div key={t} className="fundtile">
                <p className="fundtile__t">{t}</p>
                <p className="fundtile__v">{money(v)}</p>
                <p className="fundtile__d">{d}</p>
              </div>
            ))}
          </div>
          <p className="gs__fine">Amounts are order totals. BuyBridge's fees haven't been decided yet, so none are taken off in this test version.</p>

          <section className="panel" style={{ marginTop: '1.5rem' }}>
            <h2>Get paid</h2>
            {acct && !editing ? (
              <p>
                Payouts go to <strong>{acct.accountName}</strong>, {acct.bankName} {acct.accountNumberMasked}.{' '}
                <button type="button" className="linkbtn" onClick={() => setEditing(true)}>
                  Change
                </button>
              </p>
            ) : (
              <form onSubmit={saveAccount}>
                <p className="muted">Where should released money go? Use a bank account in your own name.</p>
                <div className="field">
                  <label htmlFor="pa-bank">Bank</label>
                  <input id="pa-bank" value={bank} onChange={(e) => setBank(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="pa-name">Name on the account</label>
                  <input id="pa-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="pa-num">Account number</label>
                  <input id="pa-num" inputMode="numeric" maxLength={10} value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))} required />
                </div>
                <button className="btn" type="submit" disabled={busy || num.length !== 10}>
                  Save account
                </button>
                <p className="gs__fine">Test version: the account name isn't checked with the bank yet.</p>
              </form>
            )}
            <button className="btn btn--lg" style={{ marginTop: '1rem' }} disabled={busy || !acct || !eligible} onClick={requestPayout}>
              {eligible ? `Request payout of ${money(sum.eligibleMinor)}` : 'Nothing to request yet'}
            </button>
          </section>

          {reqs.length > 0 && (
            <section className="panel" style={{ marginTop: '1rem' }}>
              <h2>Payout requests</h2>
              <ul className="co__opts">
                {reqs.map((r) => (
                  <li key={r.id}>
                    {money(r.amountMinor)} ·{' '}
                    {r.status === 'REQUESTED' ? 'Waiting for approval' : r.status === 'APPROVED' ? 'Approved and sent' : 'Not approved'}
                    {r.reviewNote && <> · {r.reviewNote}</>}
                    {r.skippedPaymentIds && r.skippedPaymentIds.length > 0 && <> · {r.skippedPaymentIds.length} left out (on hold)</>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel" style={{ marginTop: '1rem' }}>
            <h2>Sales</h2>
            {sum.items.length === 0 ? (
              <p className="muted">Paid orders will appear here.</p>
            ) : (
              <ul className="co__opts">
                {sum.items.map((i) => (
                  <li key={i.paymentId}>
                    <Link className="link" to={`/orders/${i.orderId}`}>
                      {money(i.amountMinor)}
                    </Link>{' '}
                    · {BUCKET[i.bucket] ?? i.bucket}
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
