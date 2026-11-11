import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CodeStep } from '../components/CodeStep';
import { registerAccount, signOutAccount, useAccount } from '../lib/account';

export default function GetStartedPage() {
  const navigate = useNavigate();
  const { user, loading } = useAccount();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [code, setCode] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await registerAccount({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim() });
      setJustCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  if (!user && justCreated) return <CodeStep email={email.trim()} />;

  if (user) {
    return (
      <div className="gs gs--done">
        <p className="eyebrow">{justCreated ? "You're in" : 'You already have an account here'}</p>
        <h1>{justCreated ? `Welcome, ${user.fullName.split(' ')[0]}.` : `Signed in as ${user.fullName}.`}</h1>
        <p className="gs__lede">One account lets you buy, and sell too when you're ready.</p>

        <ol className="next">
          <li>
            <strong>Buying?</strong>
            <span>Open the seller's product link, choose your options, and check out. Or enter a product code below.</span>
          </li>
          <li>
            <strong>Selling?</strong>
            <span>Choose Start selling to switch on seller tools on this same account.</span>
          </li>
        </ol>

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

        <div className="gs__ctas" style={{ marginTop: '1.5rem' }}>
          <Link className="btn btn--lg btn--secondary" to="/start-selling">
            Start selling
          </Link>
          <Link className="btn btn--lg btn--outline" to="/orders">
            My orders
          </Link>
        </div>

        {!justCreated && (
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
        <p className="gs__lede">
          One account for everything. You can buy straight away, and turn on selling later from the same account.
        </p>
        <ul className="gs__points">
          <li>No bank details or ID needed to buy.</li>
          <li>Takes under a minute.</li>
          <li>Test version: payments are simulated and no real money moves.</li>
        </ul>
      </div>

      <form className="gs__form" onSubmit={submit}>
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
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="gs__fine">
          We'll email you a code to confirm it's you. Already have an account? <Link to="/sign-in">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
