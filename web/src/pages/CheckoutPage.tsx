import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { SellerDelivery } from '../api/types';
import { feeLabel, isSameCity, isWithinState, optionLabel, speedLabel, windowLabel, zoneLabel } from '../lib/delivery';
import { registerAccount, useAccount } from '../lib/account';
import { lineKey, removeLines } from '../lib/cart';
import { clearDraft, loadDraft, type CheckoutDraft } from '../lib/checkout';
import { formatMoney } from '../lib/money';
import { NIGERIAN_STATES } from '../lib/states';

interface Address {
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  landmark: string;
}

const STEPS = ['Account', 'Delivery', 'Pay'];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, loading } = useAccount();
  const [draftLoaded] = useState<CheckoutDraft | null>(() => loadDraft());

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [address, setAddress] = useState<Address | null>(null);
  const [draft, setDraft] = useState<Address>({ recipientName: '', phone: '', street: '', city: '', state: '', landmark: '' });
  const [delivery, setDelivery] = useState<SellerDelivery | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftLoaded) return;
    api
      .getSellerDelivery(draftLoaded.sellerId)
      .then(setDelivery)
      .catch(() => setError('Could not load this seller\'s delivery options.'));
  }, [draftLoaded]);

  useEffect(() => {
    if (user) setDraft((d) => ({ ...d, recipientName: d.recipientName || user.fullName }));
  }, [user]);

  if (loading) return <p className="muted">Loading…</p>;

  if (!draftLoaded || draftLoaded.lines.length === 0) {
    return (
      <div className="card empty">
        <h1>Nothing to check out yet</h1>
        <p>Choose a product and its options first, or open your cart.</p>
        <Link className="btn" to="/cart">
          Open cart
        </Link>
      </div>
    );
  }

  const draft0 = draftLoaded;
  const currency = draft0.lines[0].currency;
  const subtotal = draft0.lines.reduce((n, l) => n + BigInt(l.priceMinor) * BigInt(l.quantity), BigInt(0));

  const step = !user ? 0 : !address ? 1 : 2;

  const storeState = delivery?.storeState ?? null;
  const within = draft.state ? isWithinState(draft.state, storeState) : null;
  const sameCity = draft.state ? isSameCity(draft.state, draft.city, storeState, delivery?.storeCity ?? null) : false;
  const inZone = (z: string) => delivery && draft.state ? delivery.options.filter((o) => o.zone === z) : [];
  // A buyer in the seller's city sees the same-city options if the seller set any, otherwise the state ones.
  const zoneOptions = sameCity && inZone('SAME_CITY').length > 0 ? inZone('SAME_CITY') : inZone(within ? 'WITHIN_STATE' : 'OUTSIDE_STATE');
  const chosen = zoneOptions.find((o) => o.id === optionId && o.isActive) ?? null;
  const deliveryFee = chosen ? BigInt(chosen.feeMinor) : BigInt(0);

  async function signUp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await registerAccount({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function saveAddress(e: FormEvent) {
    e.preventDefault();
    setAddress({ ...draft, recipientName: draft.recipientName.trim(), street: draft.street.trim(), city: draft.city.trim() });
  }

  async function pay() {
    if (!user || !address || !chosen) return;
    setBusy(true);
    setError(null);
    try {
      const { order } = await api.createOrder({
        buyerId: user.id,
        sellerId: draft0.sellerId,
        items: draft0.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, variant: l.variant })),
        deliveryOptionId: chosen?.id,
        deliveryAddress: { ...address },
      });
      if (draft0.source === 'cart') removeLines(draft0.lines.map((l) => lineKey(l)));
      clearDraft();
      navigate(`/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place the order. Try again.');
    } finally {
      setBusy(false);
    }
  }

  
  return (
    <div className="co">
      <div>
        <ol className="stepper" aria-label="Checkout steps">
          {STEPS.map((label, i) => (
            <li key={label} className={i < step ? 'is-done' : i === step ? 'is-now' : ''} aria-current={i === step ? 'step' : undefined}>
              <span className="stepper__n">{i < step ? '✓' : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <form onSubmit={signUp}>
            <h1>Create your account</h1>
            <p>Just the basics. Your choices are saved, and you'll go straight on to delivery.</p>
            <div className="field">
              <label htmlFor="co-name">Full name</label>
              <input id="co-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor="co-email">Email</label>
              <input id="co-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className="field">
              <label htmlFor="co-phone">
                Phone number <span className="field__hint">(optional)</span>
              </label>
              <input id="co-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
            {error && <p className="error">{error}</p>}
            <button className="btn btn--lg" type="submit" disabled={busy || !fullName.trim() || !email.trim()}>
              {busy ? 'Creating account…' : 'Continue to delivery'}
            </button>
            <p className="gs__fine">
              No bank details or ID needed to buy. Your account is saved in this browser for now; full login is coming.
            </p>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={saveAddress}>
            <h1>Where should it go?</h1>
            <p>The seller only gets what's needed to deliver your order.</p>
            <div className="field">
              <label htmlFor="d-name">Recipient name</label>
              <input id="d-name" value={draft.recipientName} onChange={(e) => setDraft({ ...draft, recipientName: e.target.value })} autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor="d-phone">Phone for the courier</label>
              <input id="d-phone" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} autoComplete="tel" required />
            </div>
            <div className="field">
              <label htmlFor="d-street">Street address</label>
              <input id="d-street" value={draft.street} onChange={(e) => setDraft({ ...draft, street: e.target.value })} autoComplete="street-address" required />
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="field">
                <label htmlFor="d-city">City or town</label>
                <input id="d-city" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} autoComplete="address-level2" required />
              </div>
              <div className="field">
                <label htmlFor="d-state">State</label>
                <select id="d-state" value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} required>
                  <option value="">Select</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="d-land">
                Landmark <span className="field__hint">(optional)</span>
              </label>
              <input id="d-land" value={draft.landmark} onChange={(e) => setDraft({ ...draft, landmark: e.target.value })} placeholder="Near the market gate" />
            </div>

            {draft.state && delivery && (
              <fieldset className="choices" style={{ marginTop: '0.5rem' }}>
                <legend>Delivery option</legend>
                <p className="field__hint" style={{ marginTop: 0 }}>
                  Set by this seller for {within ? `deliveries within ${storeState}` : `deliveries outside ${storeState ?? 'their state'}`}.
                </p>
                {zoneOptions.length === 0 ? (
                  <div className="nozone">
                    <h3>This seller doesn't deliver here yet</h3>
                    <p>
                      {storeState
                        ? `They haven't set up delivery ${within ? 'within' : 'outside'} ${storeState}. Try another address.`
                        : "They haven't set up delivery yet."}
                    </p>
                  </div>
                ) : (
                  <div className="dopts">
                    {zoneOptions.map((o) => (
                      <label key={o.id} className={`dopt${chosen?.id === o.id ? ' dopt--on' : ''}${o.isActive ? '' : ' dopt--off'}`}>
                        <input
                          type="radio"
                          name="delivery-option"
                          disabled={!o.isActive}
                          checked={chosen?.id === o.id}
                          onChange={() => setOptionId(o.id)}
                        />
                        <span>
                          {speedLabel(o.speed)} · {zoneLabel(o.zone, storeState, delivery?.storeCity)}
                          <small>{o.isActive ? windowLabel(o.minHours, o.maxHours) : 'Unavailable right now'}</small>
                        </span>
                        <b>{feeLabel(o.feeMinor, currency)}</b>
                      </label>
                    ))}
                  </div>
                )}
                <p className="field__hint">New seller: their on-time delivery record builds as orders are delivered.</p>
              </fieldset>
            )}

            <button className="btn btn--lg" type="submit" disabled={!draft.state || !chosen}>
              Continue to payment
            </button>
          </form>
        )}

        {step === 2 && address && (
          <div>
            <h1>Review and pay</h1>
            <p>
              Delivering to <strong>{address.recipientName}</strong>, {address.street}, {address.city}, {address.state}.{' '}
              <button type="button" className="linkbtn" onClick={() => setAddress(null)}>
                Change
              </button>
            </p>

            {chosen && (
              <p className="eta" style={{ marginBottom: '1rem' }}>
                <strong>{optionLabel(chosen, storeState)}</strong>
                {feeLabel(chosen.feeMinor, currency)} delivery. You'll see an expected-by date once the seller ships.
              </p>
            )}

            <div className="notice notice--protected">
              <strong>Payment Protected.</strong> After your payment is verified, BuyBridge holds it under its protection terms until
              delivery is confirmed. Protection has eligibility rules and doesn't guarantee every transaction.
            </div>

            <label className="consent">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I understand how payment protection works (test version, no real money moves).</span>
            </label>

            {error && <p className="error">{error}</p>}
            <button className="btn btn--lg" onClick={pay} disabled={busy || !agree}>
              {busy ? 'Placing order…' : 'Place order and pay'}
            </button>
          </div>
        )}
      </div>

      <aside className="buybox" aria-label="Order summary">
        <h2>Your order</h2>
        {draft0.lines.map((l) => (
          <div key={lineKey(l)} className="co__line">
            {l.brand && <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>{l.brand}</p>}
            <p className="co__item">
              {l.title} <span className="muted">× {l.quantity}</span>
            </p>
            {Object.keys(l.variant).length > 0 && (
              <ul className="co__opts">
                {Object.entries(l.variant).map(([k, v]) => (
                  <li key={k}>
                    {k}: <strong>{v}</strong>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted" style={{ margin: 0 }}>
              {formatMoney((BigInt(l.priceMinor) * BigInt(l.quantity)).toString(), l.currency)}
            </p>
          </div>
        ))}
        <dl className="sum">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(subtotal.toString(), currency)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd className={chosen ? '' : 'muted'}>{chosen ? feeLabel(chosen.feeMinor, currency) : 'Choose at delivery'}</dd>
          </div>
          <div>
            <dt>BuyBridge protection</dt>
            <dd className="muted">Fee not set yet</dd>
          </div>
          {chosen && (
            <div>
              <dt>
                <strong>Total</strong>
              </dt>
              <dd>{formatMoney((subtotal + deliveryFee).toString(), currency)}</dd>
            </div>
          )}
        </dl>
        <p className="gs__fine">The final amount is calculated by BuyBridge when you place the order.</p>
        <Link className="link" to={draft0.source === 'cart' ? '/cart' : `/p/${draft0.lines[0].slug}`}>
          {draft0.source === 'cart' ? 'Back to cart' : 'Change options'}
        </Link>
      </aside>
    </div>
  );
}
