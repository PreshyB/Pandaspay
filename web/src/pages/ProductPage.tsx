import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Product } from '../api/types';
import { saveSelection } from '../lib/checkout';
import { formatMoney } from '../lib/money';

function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProductPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProductBySlug(slug)
      .then(setProduct)
      .catch(() => setError('Product not found. Check the link and try again.'));
  }, [slug]);

  if (error && !product) {
    return (
      <div className="card empty">
        <h1>We can't find that product</h1>
        <p>{error}</p>
        <Link className="btn" to="/">
          Enter another product code
        </Link>
      </div>
    );
  }
  if (!product) return <p className="muted">Loading product…</p>;

  const options = product.options ?? [];
  const missing = options.filter((o) => !variant[o.name]);
  const max = product.stockQuantity > 0 ? product.stockQuantity : 0;
  const subtotal = BigInt(product.priceMinor) * BigInt(quantity);

  function goToCheckout() {
    saveSelection(slug, { quantity, variant });
    navigate(`/checkout/${slug}`);
  }

  return (
    <div className="product">
      <div>
        {product.brand && <p className="eyebrow">{product.brand}</p>}
        <h1>{product.title}</h1>
        <p className="product__price">{formatMoney(product.priceMinor, product.currency)}</p>
        <p className="muted">{max > 0 ? `${max} in stock` : 'Out of stock'}</p>
        <p className="product__desc">{product.description || 'The seller has not added a description.'}</p>
      </div>

      <aside className="buybox" aria-label="Choose your options">
        {options.map((o) => (
          <fieldset className="choices" key={o.name}>
            <legend>{o.name}</legend>
            <div className="choices__row">
              {o.values.map((v) => (
                <label key={v} className={`chip${variant[o.name] === v ? ' chip--on' : ''}`}>
                  <input
                    type="radio"
                    name={`opt-${o.name}`}
                    value={v}
                    checked={variant[o.name] === v}
                    onChange={() => setVariant((cur) => ({ ...cur, [o.name]: v }))}
                  />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="field">
          <label htmlFor="qty">Quantity</label>
          <input
            id="qty"
            type="number"
            min={1}
            max={max || 1}
            value={quantity}
            onChange={(e) => setQuantity(Math.min(Math.max(1, Math.floor(Number(e.target.value) || 1)), max || 1))}
          />
        </div>

        <dl className="sum">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(subtotal.toString(), product.currency)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd className="muted">Next step</dd>
          </div>
        </dl>

        {missing.length > 0 && <p className="field__hint">Choose: {missing.map((m) => m.name).join(', ')}</p>}

        <button className="btn btn--lg btn--block" onClick={goToCheckout} disabled={max === 0 || missing.length > 0}>
          Continue to checkout
        </button>

        <ul className="assure">
          <li>
            <Tick />
            Next: a quick sign-up if you're new, then your delivery details.
          </li>
          <li>
            <Tick />
            Payment Protected: your payment is held under BuyBridge's protection terms until delivery is confirmed.
          </li>
          <li>
            <Tick />
            Protection has rules and doesn't guarantee every transaction.
          </li>
        </ul>
      </aside>
    </div>
  );
}
