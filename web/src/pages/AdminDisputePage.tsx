import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Dispute } from '../api/types';
import { StatusBadges } from '../components/StatusBadges';
import { formatMoney } from '../lib/money';
import { AdminBanner, ageOf, DISPUTE_LABEL } from './AdminDisputesPage';

type Choice = 'seller' | 'buyer' | 'split';

export default function AdminDisputePage() {
  const { disputeId = '' } = useParams();
  const [d, setD] = useState<Dispute | null | undefined>(undefined);
  const [choice, setChoice] = useState<Choice>('buyer');
  const [pct, setPct] = useState(50);
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getDispute(disputeId)
      .then(setD)
      .catch(() => setError('Could not load this dispute.'));
  }, [disputeId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && d === undefined) return <p className="error">{error}</p>;
  if (d === undefined) return <p className="muted">Loading…</p>;
  if (d === null || !d.payment) {
    return (
      <div className="card empty">
        <h1>Dispute not found</h1>
        <Link className="btn" to="/admin/disputes">
          Back to disputes
        </Link>
      </div>
    );
  }

  const payment = d.payment;
  const total = BigInt(payment.amountMinor);
  const release = (total * BigInt(pct)) / BigInt(100);
  const refund = total - release;
  const isOpen = d.status === 'OPEN' || d.status === 'UNDER_REVIEW';
  const money = (v: bigint | string) => formatMoney(v.toString(), payment.currency);
  const outcome: Record<Choice, string> = {
    seller: `Release ${money(total)} to the seller.`,
    buyer: `Refund ${money(total)} to the buyer.`,
    split: `Pay the seller ${money(release)} and refund the buyer ${money(refund)}.`,
  };
  const ready = notes.trim().length >= 10;

  async function decide() {
    setBusy(true);
    setError(null);
    try {
      await api.resolveDispute(
        d!.id,
        choice === 'split' ? { kind: 'split', releaseMinor: release.toString(), refundMinor: refund.toString() } : { kind: choice },
        notes.trim(),
      );
      setConfirming(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That decision could not be applied.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p>
        <Link className="link" to="/admin/disputes">
          ← All disputes
        </Link>
      </p>
      <div className="order__head">
        <div>
          <h1>Dispute</h1>
          <p className="mono">{d.order?.id ?? d.paymentId}</p>
        </div>
        <div className="order__sum">
          <div className="order__total">{money(total)}</div>
          <p className="muted">{DISPUTE_LABEL[d.status]}</p>
        </div>
      </div>

      <AdminBanner />

      <div className="co">
        <div>
          <section className="panel">
            <h2>What the buyer reported</h2>
            <p>
              <strong>{d.reason}</strong>
            </p>
            {d.details && <p>{d.details}</p>}
            <p className="muted">
              Opened {ageOf(d.createdAt)} ago. Evidence uploads aren't built yet, so there's nothing attached.
            </p>
          </section>

          <section className="panel" style={{ marginTop: '1rem' }}>
            <h2>The order</h2>
            {d.order ? (
              <>
                <div className="order__badges">
                  <StatusBadges orderStatus={d.order.status} paymentStatus={payment.protectionStatus} />
                </div>
                <ul className="co__opts">
                  {d.order.items.map((i) => (
                    <li key={i.id}>
                      {i.quantity} × {money(i.unitPriceMinor)}
                      {i.variant && Object.keys(i.variant).length > 0 && <> · {Object.values(i.variant).join(' / ')}</>}
                    </li>
                  ))}
                  <li>Delivery: {d.order.deliveryFeeMinor ? money(d.order.deliveryFeeMinor) : 'none'}</li>
                  {d.order.deliveryAddress?.waybillRef && <li>Waybill: <span className="mono">{d.order.deliveryAddress.waybillRef}</span></li>}
                  {d.order.deliveredAt && <li>Delivered {new Date(d.order.deliveredAt).toLocaleDateString('en-NG')}</li>}
                </ul>
                <Link className="link" to={`/orders/${d.order.id}`}>
                  Open the full order
                </Link>
              </>
            ) : (
              <p className="muted">Order details unavailable.</p>
            )}
          </section>
        </div>

        <aside className="buybox" aria-label="Decision">
          {!isOpen ? (
            <>
              <h2>Decision made</h2>
              <p>
                <strong>{DISPUTE_LABEL[d.status]}</strong>
              </p>
              {d.status === 'RESOLVED_SPLIT' && d.splitReleaseMinor && d.splitRefundMinor && (
                <p>
                  Seller {money(d.splitReleaseMinor)}, buyer refunded {money(d.splitRefundMinor)}.
                </p>
              )}
              {d.resolutionNotes && <p className="muted">"{d.resolutionNotes}"</p>}
            </>
          ) : (
            <>
              <h2>Your decision</h2>
              {(
                [
                  ['seller', 'Release to the seller', 'The payment re-enters the normal release path.'],
                  ['buyer', 'Refund the buyer', 'The full amount goes back to the buyer.'],
                  ['split', 'Split the payment', 'Pay part to the seller, refund the rest.'],
                ] as Array<[Choice, string, string]>
              ).map(([id, title, text]) => (
                <label key={id} className={`dopt${choice === id ? ' dopt--on' : ''}`}>
                  <input type="radio" name="decision" checked={choice === id} onChange={() => { setChoice(id); setConfirming(false); }} />
                  <span>
                    {title}
                    <small>{text}</small>
                  </span>
                </label>
              ))}

              {choice === 'split' && (
                <div className="field">
                  <label htmlFor="pct">Seller gets {pct}%</label>
                  <input id="pct" type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
                  <p className="field__hint">
                    Seller {money(release)} · Buyer {money(refund)}
                  </p>
                </div>
              )}

              <div className="field">
                <label htmlFor="notes">
                  Reason for this decision <span className="field__hint">(kept on the record)</span>
                </label>
                <textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you checked and why" />
              </div>

              {error && <p className="error">{error}</p>}

              {!confirming ? (
                <button className="btn btn--lg btn--block" disabled={!ready} onClick={() => setConfirming(true)}>
                  Review decision
                </button>
              ) : (
                <div className="notice notice--amber">
                  <strong>Confirm:</strong> {outcome[choice]} This can't be undone.
                  <div className="row" style={{ marginTop: '0.75rem' }}>
                    <button className="btn btn--danger" disabled={busy} onClick={decide}>
                      {busy ? 'Applying…' : 'Confirm decision'}
                    </button>
                    <button className="btn btn--outline" disabled={busy} onClick={() => setConfirming(false)}>
                      Go back
                    </button>
                  </div>
                </div>
              )}
              <p className="gs__fine">Test mode: a second approver (maker-checker) isn't built yet.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
