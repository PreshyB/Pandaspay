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

const STAGES = [
  ['You pay', 'Your payment is verified and goes under BuyBridge protection.'],
  ['Payment Protected', 'The seller sees the funds are protected, then ships your order.'],
  ['You confirm', 'Tap "I\'ve received this order". A protection window starts.'],
  ['Funds released', 'No dispute in the window? The seller\'s Protected Funds are released.'],
] as const;

/**
 * The product in one loop: money crosses from buyer to a vault under the bridge,
 * the parcel travels the other way, and the seller is paid last. Without motion
 * it shows the "held" moment, and the four captions read as a plain list.
 */
export function HeroScene() {
  return (
    <figure className="scene">
      <svg
        className="scene__svg"
        viewBox="0 0 560 320"
        role="img"
        aria-label="Animation: the buyer's payment moves to a BuyBridge vault under the bridge, the parcel travels to the buyer, and only then is the seller paid."
      >
        <rect className="scene__vault" x="222" y="224" width="116" height="62" rx="14" />
        <line className="scene__hanger" x1="248" y1="200" x2="248" y2="224" />
        <line className="scene__hanger" x1="312" y1="200" x2="312" y2="224" />
        {/* things that slide behind the two banks, above the vault */}
        <g transform="translate(110 196)">
          <g className="scene__coin">
            <circle r="17" className="scene__coinface" />
            <text y="7" textAnchor="middle" className="scene__coinglyph">
              ₦
            </text>
          </g>
        </g>
        <g transform="translate(430 168)">
          <g className="scene__parcel">
            <rect width="32" height="28" rx="3" className="scene__box" />
            <path d="M16 0v28M0 11h32" className="scene__tape" />
          </g>
        </g>

        <circle className="scene__bank" cx="64" cy="196" r="46" />
        <circle className="scene__bank" cx="496" cy="196" r="46" />
        <text className="scene__label" x="64" y="202" textAnchor="middle">
          You
        </text>
        <text className="scene__label" x="496" y="202" textAnchor="middle">
          Seller
        </text>
        <circle className="scene__paid" cx="496" cy="196" r="46" />

        {HANGERS.map(([x, y]) => (
          <line key={x} className="scene__hanger" x1={x} y1={y} x2={x} y2={194} />
        ))}
        <line className="scene__deck" x1="110" y1="196" x2="450" y2="196" />
        <path className="scene__arch" d="M130 196 Q280 -10 430 196" pathLength={1} />

        <text className="scene__note" x="280" y="306" textAnchor="middle">
          Held by BuyBridge
        </text>

        <g className="scene__tick" transform="translate(98 150)">
          <circle r="14" />
          <path d="M-6 0l4.5 4.5L7 -4.5" />
        </g>
      </svg>

      <ol className="stages" aria-label="The four stages of a protected order">
        {STAGES.map(([title, text], i) => (
          <li key={title} className={`stages__i stages__i--${i + 1}`}>
            <span className="stages__n" aria-hidden="true">
              {i + 1}
            </span>
            <strong>{title}</strong>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
