import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { DeliverySpeed, DeliveryZone, SellerDelivery } from '../api/types';
import { feeLabel, speedLabel, TIME_PRESETS, windowLabel, zoneLabel } from '../lib/delivery';
import { useDevIdentity } from '../lib/useDevIdentity';
import { NIGERIAN_STATES } from '../lib/states';

export default function SellerDeliveryPage() {
  const { user: seller, loading } = useDevIdentity('seller');
  const [info, setInfo] = useState<SellerDelivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [stateDraft, setStateDraft] = useState('');
  const [cityDraft, setCityDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [zone, setZone] = useState<DeliveryZone>('WITHIN_STATE');
  const [speed, setSpeed] = useState<DeliverySpeed>('STANDARD');
  const [charge, setCharge] = useState(false);
  const [fee, setFee] = useState('');
  const [timeId, setTimeId] = useState('sameday');

  const refresh = useCallback(() => {
    if (!seller) return;
    api
      .getSellerDelivery(seller.id)
      .then((d) => {
        setInfo(d);
        setStateDraft((cur) => cur || d.storeState || '');
        setCityDraft((cur) => cur || d.storeCity || '');
      })
      .catch(() => setError('Could not load your delivery setup.'));
  }, [seller]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!seller) {
    return (
      <div className="card empty">
        <h1>Start selling first</h1>
        <p>Delivery setup is part of your seller tools.</p>
        <Link className="btn" to="/start-selling">
          Start selling
        </Link>
      </div>
    );
  }
  if (!info) return <p className="muted">{error ?? 'Loading your delivery setup…'}</p>;

  const storeState = info.storeState;
  const preset = TIME_PRESETS.find((p) => p.id === timeId)!;
  const feeNumber = Number(fee);
  const feeOk = !charge || (Number.isFinite(feeNumber) && feeNumber > 0);

  return (
    <div className="dl">
      <div>
        <div className="page-head">
          <h1>Delivery and shipping</h1>
          <p>
            You decide what delivery costs and how long it takes. Buyers see this exact promise at checkout, so set what you can
            actually keep to.
          </p>
        </div>

        <section className="panel dl__block" aria-labelledby="loc-h">
          <h2 id="loc-h">Store location</h2>
          <p className="muted" style={{ margin: '0 0 1rem' }}>
            Your delivery zones are named from this: "Within {storeState ?? 'your state'}" and "Outside {storeState ?? 'your state'}".
          </p>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="field">
              <label htmlFor="st-state">State</label>
              <select id="st-state" value={stateDraft} onChange={(e) => setStateDraft(e.target.value)}>
                <option value="">Select</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="st-city">City or town</label>
              <input id="st-city" value={cityDraft} onChange={(e) => setCityDraft(e.target.value)} placeholder="Aba" />
            </div>
          </div>
          <button
            className="btn btn--secondary"
            disabled={busy || !stateDraft || (stateDraft === storeState && cityDraft === (info.storeCity ?? ''))}
            onClick={() => run(() => api.setStoreLocation(seller.id, stateDraft, cityDraft))}
          >
            {storeState ? 'Update location' : 'Save location'}
          </button>
        </section>

        {error && <p className="error">{error}</p>}

        {storeState && (
          <section className="panel dl__block" aria-labelledby="zones-h">
            <div className="row-between">
              <h2 id="zones-h">Your delivery options</h2>
              {info.options.length > 0 && !adding && (
                <button className="btn btn--outline btn--sm" onClick={() => setAdding(true)}>
                  Add another zone
                </button>
              )}
            </div>

            {info.options.length === 0 && !adding && (
              <div className="dl__empty">
                <h3>No delivery zones yet</h3>
                <p>Add at least one zone before you can list a product. Buyers need to know what delivery costs and when it arrives.</p>
                <button className="btn" onClick={() => setAdding(true)}>
                  Add your first zone
                </button>
              </div>
            )}

            {info.options.length > 0 && (
              <ul className="zones">
                {info.options.map((o) => (
                  <li key={o.id} className={`zone${o.isActive ? '' : ' zone--off'}`}>
                    <div>
                      <strong>
                        {zoneLabel(o.zone, storeState, info.storeCity)} · {speedLabel(o.speed)}
                      </strong>
                      <span>{windowLabel(o.minHours, o.maxHours)}</span>
                    </div>
                    <b>{feeLabel(o.feeMinor)}</b>
                    <span className={`badge-s ${o.isActive ? 'badge-s--on' : ''}`}>{o.isActive ? 'Active' : 'Paused'}</span>
                    <button
                      className="btn btn--outline btn--sm"
                      disabled={busy}
                      onClick={() => run(() => api.setDeliveryActive(o.id, seller.id, !o.isActive))}
                    >
                      {o.isActive ? 'Pause' : 'Resume'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {adding && (
              <form
                className="dl__form"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api.saveDeliveryOption({
                      sellerId: seller.id,
                      zone,
                      speed,
                      feeMinor: charge ? Math.round(feeNumber * 100) : 0,
                      minHours: preset.min,
                      maxHours: preset.max,
                    });
                    setAdding(false);
                    setCharge(false);
                    setFee('');
                  });
                }}
              >
                <h3>Add a zone</h3>

                <fieldset className="choices">
                  <legend>Zone</legend>
                  <div className="choices__row">
                    {(['SAME_CITY', 'WITHIN_STATE', 'OUTSIDE_STATE'] as DeliveryZone[]).filter((z) => z !== 'SAME_CITY' || !!info.storeCity).map((z) => (
                      <label key={z} className={`chip${zone === z ? ' chip--on' : ''}`}>
                        <input type="radio" name="zone" checked={zone === z} onChange={() => setZone(z)} />
                        {zoneLabel(z, storeState, info.storeCity)}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="choices">
                  <legend>Speed</legend>
                  <div className="choices__row">
                    {(['STANDARD', 'EXPRESS'] as DeliverySpeed[]).map((s) => (
                      <label key={s} className={`chip${speed === s ? ' chip--on' : ''}`}>
                        <input type="radio" name="speed" checked={speed === s} onChange={() => setSpeed(s)} />
                        {s === 'STANDARD' ? 'Standard' : 'Express (add-on)'}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="choices">
                  <legend>Fee</legend>
                  <div className="choices__row">
                    <label className={`chip${!charge ? ' chip--on' : ''}`}>
                      <input type="radio" name="fee" checked={!charge} onChange={() => setCharge(false)} />
                      Free delivery
                    </label>
                    <label className={`chip${charge ? ' chip--on' : ''}`}>
                      <input type="radio" name="fee" checked={charge} onChange={() => setCharge(true)} />
                      Charge a fee
                    </label>
                  </div>
                  {charge && (
                    <div className="field" style={{ marginTop: '0.75rem', maxWidth: '14rem' }}>
                      <label htmlFor="fee">Fee (NGN)</label>
                      <input id="fee" type="number" min={1} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="2000" />
                    </div>
                  )}
                </fieldset>

                <div className="field" style={{ maxWidth: '18rem' }}>
                  <label htmlFor="time">Delivery time</label>
                  <select id="time" value={timeId} onChange={(e) => setTimeId(e.target.value)}>
                    {TIME_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <p className="field__hint">Anywhere from under 2 hours to 5 days. Set what you can keep to.</p>
                </div>

                <div className="row">
                  <button className="btn" type="submit" disabled={busy || !feeOk}>
                    Save zone
                  </button>
                  <button className="btn btn--outline" type="button" onClick={() => setAdding(false)}>
                    Cancel
                  </button>
                </div>
                <p className="field__hint">Saving a zone and speed you already have updates it.</p>
              </form>
            )}
          </section>
        )}
      </div>

      <aside className="preview" aria-label="What buyers will see">
        <h2>What buyers will see</h2>
        <p className="muted">At checkout, after they enter their address:</p>
        {info.options.length === 0 ? (
          <p className="preview__desc">Your delivery options will appear here.</p>
        ) : (
          <ul className="opts">
            {info.options.map((o) => (
              <li key={o.id} className={o.isActive ? '' : 'opts__off'}>
                <span>
                  {speedLabel(o.speed)} · {zoneLabel(o.zone, storeState, info.storeCity)} · {windowLabel(o.minHours, o.maxHours)}
                  {!o.isActive && <em> — unavailable</em>}
                </span>
                <b>{feeLabel(o.feeMinor)}</b>
              </li>
            ))}
          </ul>
        )}
        <p className="field__hint">Paused options show as unavailable, so returning buyers aren't confused when they come back.</p>
      </aside>
    </div>
  );
}
