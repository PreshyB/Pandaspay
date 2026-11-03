import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/** Hangers of the tied-arch bridge: [x, y on the arch]. The arch is a quadratic curve, so y is exact. */
const HANGERS: Array<[number, number]> = [
  [175, 143.5],
  [205, 118.8],
  [235, 102.3],
  [280, 93],
  [325, 102.3],
  [355, 118.8],
  [385, 143.5],
];

function Bridge() {
  return (
    <svg
      className="bridge"
      viewBox="0 0 560 300"
      role="img"
      aria-label="Your payment is held by BuyBridge, between you and the seller, until delivery is confirmed."
    >
      <circle className="bridge__bank" cx="64" cy="196" r="46" />
      <circle className="bridge__bank" cx="496" cy="196" r="46" />
      <text className="bridge__label" x="64" y="203" textAnchor="middle">
        You
      </text>
      <text className="bridge__label" x="496" y="203" textAnchor="middle">
        Seller
      </text>

      {HANGERS.map(([x, y]) => (
        <line key={x} className="bridge__hanger" x1={x} y1={y} x2={x} y2={194} />
      ))}
      <line className="bridge__deck" x1="110" y1="196" x2="450" y2="196" />
      <path className="bridge__arch" d="M130 196 Q280 -10 430 196" pathLength={1} />

      <line className="bridge__hanger" x1="235" y1="200" x2="235" y2="224" />
      <line className="bridge__hanger" x1="325" y1="200" x2="325" y2="224" />
      <rect className="bridge__chip" x="180" y="224" width="200" height="62" rx="14" />
      <text className="bridge__amount" x="280" y="252" textAnchor="middle">
        ₦18,500
      </text>
      <text className="bridge__note" x="280" y="274" textAnchor="middle">
        held by BuyBridge
      </text>
    </svg>
  );
}

export default function HomePage() {
  const [slug, setSlug] = useState('');
  const navigate = useNavigate();

  return (
    <div>
      <section className="hero">
        <div>
          <h1>Pay now. The seller is paid when your order arrives.</h1>
          <p className="hero__lede">
            Found something on WhatsApp, Instagram or TikTok? Paste the product code the seller sent you.
            BuyBridge holds your payment until you confirm delivery.
          </p>

          <form
            className="find"
            onSubmit={(e) => {
              e.preventDefault();
              if (slug.trim()) navigate(`/p/${slug.trim()}`);
            }}
          >
            <label htmlFor="slug">Product code</label>
            <div className="find__row">
              <input
                id="slug"
                className="input"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. a1b2c3d4"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button className="btn btn--lg" type="submit" disabled={!slug.trim()}>
                Find product
              </button>
            </div>
          </form>
        </div>

        <div className="hero__figure">
          <Bridge />
        </div>
      </section>

      <ol className="flow" aria-label="How a protected order works">
        <li>
          <strong>You pay</strong>
          BuyBridge holds the money. The seller can't touch it yet.
        </li>
        <li>
          <strong>Seller ships</strong>
          They accept your order and add a waybill reference.
        </li>
        <li>
          <strong>You confirm</strong>
          Tap "I've received this order" when it arrives.
        </li>
        <li>
          <strong>Seller is paid</strong>
          After a short protection window with no dispute.
        </li>
      </ol>

      <section className="split">
        <div className="split__item">
          <h2>Selling on chat?</h2>
          <p>
            List a product, get a link, and share it in your DMs. Buyers pay before you ship, and you're paid
            once delivery is confirmed.
          </p>
          <Link className="btn btn--secondary" to="/seller/new-product">
            List a product
          </Link>
        </div>
        <div className="split__item">
          <h2>Something wrong with an order?</h2>
          <p>
            Open a dispute from the order page. The payment is frozen until the problem is resolved, so the
            seller isn't paid while it's open.
          </p>
        </div>
      </section>
    </div>
  );
}
