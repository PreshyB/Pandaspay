import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { registerAccount, signOutAccount, useAccount } from '../lib/account';

type Role = 'buyer' | 'seller';

const ROLES: Array<{ id: Role; title: string; line: string }> = [
  { id: 'buyer', title: "I'm buying", line: 'Pay safely for something a seller shared with you.' },
  { id: 'seller', title: "I'm selling", line: 'List products, share links, get paid when orders arrive.' },
];

export default function GetStartedPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAccount();
  const [role, setRole] = useState<Role>(params.get('role') === 'seller' ? 'seller' : 'buyer');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; role: Role } | null>(null);
  const [code, setCode] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await registerAccount({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim(), role });
      setDone({ name: created.fullName, role });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  const finished = done ?? (user ? { name: user.fullName, role } : null);

  if (finished) {
    const seller = finished.role === 'seller';
    return (
      <div className="gs gs--done">
        <p className="eyebrow">{done ? "You're in" : 'You already have an account here'}</p>
        <h1>{done ? `Welcome, ${finished.name.split(' ')[0]}.` : `Signed in as ${finished.name}.`}</h1>
        <p className="gs__lede">Here is what to do next.</p>

        <ol className="next">
          {seller ? (
            <>
              <li>
                <strong>List your first product.</strong>
                <span>Add a name and price. You get a link to send to buyers.</span>
              </li>
              <li>
                <strong>Share the link in your chat.</strong>
                <span>Buyers pay BuyBridge first, so you can ship with confidence.</span>
              </li>
              <li>
                <strong>Accept, ship, add the waybill.</strong>
                <span>You're paid after delivery is confirmed and the 72-hour window passes.</span>
              </li>
            </>
          ) : (
            <>
              <li>
                <strong>Get the seller's product link or code.</strong>
                <span>They send it to you in chat.</span>
              </li>
              <li>
                <strong>Pay and follow your order.</strong>
                <span>Your money is held until you confirm delivery.</span>
              </li>
              <li>
                <strong>Confirm delivery, or report a problem.</strong>
                <span>You have 72 hours after delivery to open a dispute.</span>
              </li>
            </>
          )}
        </ol>

        {seller ? (
          <div className="gs__ctas">
            <Link className="btn btn--lg" to="/seller/new-product">
              List a product
            </Link>
            <Link className="btn btn--lg btn--outline" to="/seller">
              Seller dashboard
            </Link>
          </div>
        ) : (
          <>
            <form
              className="find"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) navigate(`/p/${code.trim()}`);
              }}
            >
              <label htmlFor="gs-code">Have a product code?</label>
              <div className="find__row">
                <input
                  id="gs-code"
                  className="input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. a1b2c3d4"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <button className="btn btn--lg" type="submit" disabled={!code.trim()}>
                  Find product
                </button>
              </div>
            </form>
            <p className="gs__alt">
              <Link className="link" to="/orders">
                See my orders
              </Link>
            </p>
          </>
        )}

        {!done && (
          <p className="gs__alt">
            Not you?{' '}
            <button type="button" className="linkbtn" onClick={signOutAccount}>
              Sign out of this browser
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="gs">
      <div className="gs__intro">
        <p className="eyebrow">Get started</p>
        <h1>Create your free account</h1>
        <p className="gs__lede">Tell us how you'll use BuyBridge. You can do both later.</p>
        <ul className="gs__points">
          <li>No payment details needed to sign up.</li>
          <li>Takes under a minute.</li>
          <li>Test version: payments are simulated and no real money moves.</li>
        </ul>
      </div>

      <form className="gs__form" onSubmit={submit}>
        <fieldset className="roles">
          <legend>I want to</legend>
          {ROLES.map((r) => (
            <label key={r.id} className={`role${role === r.id ? ' role--on' : ''}`}>
              <input type="radio" name="role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} />
              <span className="role__t">{r.title}</span>
              <span className="role__l">{r.line}</span>
            </label>
          ))}
        </fieldset>

        <div className="field">
          <label htmlFor="gs-name">Full name</label>
          <input id="gs-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
        </div>
        <div className="field">
          <label htmlFor="gs-email">Email</label>
          <input id="gs-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="gs-phone">
            Phone number <span className="field__hint">(optional)</span>
          </label>
          <input id="gs-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </div>

        {error && <p className="error">{error}</p>}

        <button className="btn btn--lg btn--block" type="submit" disabled={busy || !fullName.trim() || !email.trim()}>
          {busy ? 'Creating account…' : role === 'seller' ? 'Create seller account' : 'Create buyer account'}
        </button>
        <p className="gs__fine">
          Your account is saved in this browser for now. Signing in from another device arrives with full login.
        </p>
      </form>
    </div>
  );
}
