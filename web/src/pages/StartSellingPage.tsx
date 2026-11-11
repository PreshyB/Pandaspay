import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { applyToSell } from '../api/users';
import { NIGERIAN_STATES } from '../lib/states';
import { useAccount } from '../lib/account';

const STEPS: Array<[string, string]> = [
  ['Tell us about your store', 'Your store name, where you sell, and where you ship from.'],
  ['BuyBridge reviews it', 'An admin checks your details before selling goes live.'],
  ['Identity and payout checks', 'Required before real payouts. Not built yet in this test version.'],
  ['List products and share links', 'Once approved, seller tools switch on for this same account.'],
];

export default function StartSellingPage() {
  const { user, isSeller, sellerStatus, loading, refresh } = useAccount();
  const [businessName, setBusinessName] = useState('');
  const [socialLink, setSocialLink] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <p className="muted">Loading…</p>;

  if (!user) {
    return (
      <div className="card empty">
        <h1>Start selling on BuyBridge</h1>
        <p>Selling is a part of your one BuyBridge account. Create your account or sign in first, then come back here.</p>
        <div className="row">
          <Link className="btn" to="/get-started">
            Create your account
          </Link>
          <Link className="btn btn--outline" to="/sign-in">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await applyToSell({
        businessName: businessName.trim(),
        socialLink: socialLink.trim() || undefined,
        note: note.trim() || undefined,
        storeState: state,
        storeCity: city.trim() || undefined,
        userId: user!.id,
      });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your application.');
    } finally {
      setBusy(false);
    }
  }

  if (isSeller) {
    return (
      <div className="gs gs--done">
        <p className="eyebrow">Start selling</p>
        <h1>You're approved to sell.</h1>
        <p className="gs__lede">Seller tools are on for your account.</p>
        <div className="gs__ctas">
          <Link className="btn btn--lg" to="/seller/delivery">
            Set up delivery
          </Link>
          <Link className="btn btn--lg btn--outline" to="/seller/new-product">
            List a product
          </Link>
          <Link className="btn btn--lg btn--outline" to="/seller">
            Seller dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (sellerStatus === 'PENDING') {
    return (
      <div className="gs gs--done">
        <p className="eyebrow">Start selling</p>
        <h1>Your application is being reviewed.</h1>
        <p className="gs__lede">
          We'll switch on seller tools on this account once it's approved. Check back here; you don't need to apply again.
        </p>
        {user.sellerApplication && (
          <p className="muted">
            Submitted for <strong>{user.sellerApplication.businessName}</strong>.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="gs">
      <div className="gs__intro">
        <p className="eyebrow">Start selling</p>
        <h1>Apply to sell</h1>
        <p className="gs__lede">Selling is added to your existing account, so there's no second login.</p>
        <ol className="next">
          {STEPS.map(([t, d]) => (
            <li key={t}>
              <strong>{t}</strong>
              <span>{d}</span>
            </li>
          ))}
        </ol>
      </div>

      <form className="gs__form" onSubmit={submit}>
        {sellerStatus === 'REJECTED' && (
          <div className="notice notice--amber">
            <strong>Your last application wasn't approved.</strong> {user.sellerReviewNote} You can update your details and apply again.
          </div>
        )}
        <div className="field">
          <label htmlFor="ss-name">Store or business name</label>
          <input id="ss-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="ss-social">
            Instagram, WhatsApp or other page <span className="field__hint">(optional)</span>
          </label>
          <input id="ss-social" value={socialLink} onChange={(e) => setSocialLink(e.target.value)} placeholder="@yourstore or a link" />
        </div>
        <div className="field">
          <label htmlFor="ss-state">State you ship from</label>
          <select id="ss-state" value={state} onChange={(e) => setState(e.target.value)} required>
            <option value="">Choose a state</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ss-city">
            City or town <span className="field__hint">(optional)</span>
          </label>
          <input id="ss-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ss-note">
            What do you sell? <span className="field__hint">(optional)</span>
          </label>
          <textarea id="ss-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn--lg btn--block" type="submit" disabled={busy || !businessName.trim() || !state}>
          {busy ? 'Sending…' : 'Send application'}
        </button>
        <p className="gs__fine">Test version: no ID or payout details are collected yet.</p>
      </form>
    </div>
  );
}
