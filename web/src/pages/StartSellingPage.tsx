import { Link, useNavigate } from 'react-router-dom';
import { activateSelling, useAccount } from '../lib/account';

const STEPS: Array<[string, string]> = [
  ['Personal information', 'Who you are, from your account.'],
  ['Identity verification', 'Required before real payouts. Not built yet in this test version.'],
  ['Business or store information', 'Your store name and where you ship from.'],
  ['Payout destination', 'The verified account your released funds go to.'],
  ['Review and approval', 'BuyBridge reviews your details before selling goes live.'],
];

export default function StartSellingPage() {
  const navigate = useNavigate();
  const { user, isSeller, loading } = useAccount();

  if (loading) return <p className="muted">Loading…</p>;

  if (!user) {
    return (
      <div className="card empty">
        <h1>Start selling on BuyBridge</h1>
        <p>Selling is a part of your one BuyBridge account. Create your account first, then come back here.</p>
        <Link className="btn" to="/get-started">
          Create your account
        </Link>
      </div>
    );
  }

  return (
    <div className="gs gs--done">
      <p className="eyebrow">Start selling</p>
      <h1>{isSeller ? 'Seller tools are on.' : 'Turn on selling for your account.'}</h1>
      <p className="gs__lede">
        Selling is added to your existing account, so there's no second login. Here is how seller activation will work:
      </p>

      <ol className="next">
        {STEPS.map(([t, d]) => (
          <li key={t}>
            <strong>{t}</strong>
            <span>{d}</span>
          </li>
        ))}
      </ol>

      <div className="notice notice--amber">
        <strong>Test version.</strong> Verification and payout setup aren't built yet, so you can switch seller tools on now to try
        listing products and receiving test orders.
      </div>

      <div className="gs__ctas" style={{ marginTop: '1.5rem' }}>
        {isSeller ? (
          <>
            <Link className="btn btn--lg" to="/seller/new-product">
              List a product
            </Link>
            <Link className="btn btn--lg btn--outline" to="/seller">
              Seller dashboard
            </Link>
          </>
        ) : (
          <button
            className="btn btn--lg"
            onClick={() => {
              activateSelling(user.id);
              navigate('/seller/new-product');
            }}
          >
            Switch on seller tools (test)
          </button>
        )}
      </div>
    </div>
  );
}
