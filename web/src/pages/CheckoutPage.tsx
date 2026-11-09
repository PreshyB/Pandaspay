import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Product } from '../api/types';
import { registerAccount, useAccount } from '../lib/account';
import { loadSelection, type Selection } from '../lib/checkout';
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
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAccount();
  const [product, setProduct] = useState<Product | null>(null);
  const [selection] = useState<Selection | null>(() => loadSelection(slug));
  const [loadError, setLoadError] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [address, setAddress] = useState<Address | null>(null);
  const [draft, setDraft] = useState<Address>({ recipientName: '', phone: '', street: '', city: '', state: '', landmark: '' });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProductBySlug(slug)
      .then(setProduct)
      .catch(() => setLoadError(true));
  }, [slug]);

  useEffect(() => {
    if (user) setDraft((d) => ({ ...d, recipientName: d.recipientName || user.fullName }));
  }, [user]);

  if (loadError) {
    return (
      <div className="card empty">
        <h1>We can't find that product</h1>
        <Link className="btn" to="/">
          Back to home
        </Link>
      </div>
    );
  }
  if (loading || !product) return <p className="muted">Loading…</p>;

  if (!selection) {
    return (
      <div className="card empty">
        <h1>Choose your options first</h1>
        <p>We need your colour, size or quantity before checkout.</p>
        <Link className="btn" to={`/p/${slug}`}>
          Back to the product
        </Link>
      </div>
    );
  }

  const step = !user ? 0 : !address ? 1 : 2;
  const subtotal = BigInt(product.priceMinor) * BigInt(selection.quantity);

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
    if (!user || !address || !product) return;
    setBusy(true);
    setError(null);
    try {
      const { order } = await api.createOrder({
        buyerId: user.id,
        sellerId: product.sellerId,
        items: [{ productId: product.id, quantity: selection!.quantity, variant: selection!.variant }],
        deliveryAddress: { ...address },
      });
      navigate(`/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place the order. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const chosen = Object.entries(selection.variant);

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

            <div className="notice notice--neutral">
              <strong>Delivery option and fee:</strong> the seller's delivery options and courier pricing aren't set up yet in this
              test version, so no delivery fee is added.
            </div>

            <button className="btn btn--lg" type="submit" disabled={!draft.state}>
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
        {product.brand && <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>{product.brand}</p>}
        <p className="co__item">{product.title}</p>
        {chosen.length > 0 && (
          <ul className="co__opts">
            {chosen.map(([k, v]) => (
              <li key={k}>
                {k}: <strong>{v}</strong>
              </li>
            ))}
          </ul>
        )}
        <dl className="sum">
          <div>
            <dt>
              {formatMoney(product.priceMinor, product.currency)} × {selection.quantity}
            </dt>
            <dd>{formatMoney(subtotal.toString(), product.currency)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd className="muted">Not added yet</dd>
          </div>
        </dl>
        <p className="gs__fine">The final amount is calculated by BuyBridge when you place the order.</p>
        <Link className="link" to={`/p/${slug}`}>
          Change options
        </Link>
      </aside>
    </div>
  );
}
