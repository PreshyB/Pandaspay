import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Product } from '../api/types';
import { addToCart } from '../lib/cart';
import { saveDraft, type CheckoutLine } from '../lib/checkout';
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
  const [added, setAdded] = useState(false);

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
  const skus = product.skus ?? [];
  const hasSkus = skus.length > 0;
  const missing = options.filter((o) => !variant[o.name]);
  const complete = missing.length === 0;

  /** Stock of the exact combination chosen (only known once every choice is made). */
  const chosenSku = hasSkus && complete ? skus.find((s) => options.every((o) => s.attributes[o.name] === variant[o.name])) : undefined;
  const totalStock = hasSkus ? skus.reduce((n, s) => n + s.stockQuantity, 0) : product.stockQuantity;
  const max = hasSkus ? (complete ? chosenSku?.stockQuantity ?? 0 : totalStock) : totalStock;
  const qty = Math.max(1, Math.min(quantity, max || 1));

  /** Is this value still available, given what else is already picked? */
  function available(optName: string, value: string) {
    if (!hasSkus) return true;
    return skus.some(
      (s) =>
        s.attributes[optName] === value &&
        s.stockQuantity > 0 &&
        Object.entries(variant).every(([k, v]) => k === optName || s.attributes[k] === v),
    );
  }

  const subtotal = BigInt(product.priceMinor) * BigInt(qty);
  const canBuy = complete && max > 0 && (!hasSkus || !!chosenSku);
  const chosenLabel = Object.values(variant).join(' / ');

  function asLine(): CheckoutLine {
    return {
      productId: product!.id,
      slug,
      title: product!.title,
      brand: product!.brand,
      priceMinor: product!.priceMinor,
      currency: product!.currency,
      quantity: qty,
      variant,
    };
  }

  function buyNow() {
    saveDraft({ sellerId: product!.sellerId, source: 'buy-now', lines: [asLine()] });
    navigate('/checkout');
  }

  function addLine() {
    addToCart({ ...asLine(), sellerId: product!.sellerId, maxQty: max });
    setAdded(true);
  }

  return (
    <div className="product">
      <div>
        {product.brand && <p className="eyebrow">{product.brand}</p>}
        <h1>{product.title}</h1>
        <p className="product__price">{formatMoney(product.priceMinor, product.currency)}</p>
        <p className="muted">
          {chosenSku
            ? `${chosenSku.stockQuantity} left in ${chosenLabel}`
            : totalStock > 0
              ? `${totalStock} in stock`
              : 'Out of stock'}
        </p>
        <p className="product__desc">{product.description || 'The seller has not added a description.'}</p>
      </div>

      <aside className="buybox" aria-label="Choose your options">
        {options.map((o) => (
          <fieldset className="choices" key={o.name}>
            <legend>{o.name}</legend>
            <div className="choices__row">
              {o.values.map((v) => {
                const ok = available(o.name, v);
                return (
                  <label key={v} className={`chip${variant[o.name] === v ? ' chip--on' : ''}${ok ? '' : ' chip--off'}`}>
                    <input
                      type="radio"
                      name={`opt-${o.name}`}
                      value={v}
                      disabled={!ok}
                      checked={variant[o.name] === v}
                      onChange={() => {
                        setVariant((cur) => ({ ...cur, [o.name]: v }));
                        setAdded(false);
                      }}
                    />
                    {v}
                    {!ok && <small> · out of stock</small>}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="field">
          <label htmlFor="qty">Quantity</label>
          <div className="stepper-q">
            <button type="button" className="btn btn--outline btn--sm" aria-label="One fewer" onClick={() => setQuantity(Math.max(1, qty - 1))} disabled={qty <= 1}>
              –
            </button>
            <input
              id="qty"
              type="number"
              min={1}
              max={max || 1}
              value={qty}
              onChange={(e) => setQuantity(Math.floor(Number(e.target.value) || 1))}
            />
            <button type="button" className="btn btn--outline btn--sm" aria-label="One more" onClick={() => setQuantity(Math.min(max || 1, qty + 1))} disabled={qty >= (max || 1)}>
              +
            </button>
          </div>
        </div>

        <dl className="sum">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(subtotal.toString(), product.currency)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd className="muted">At checkout</dd>
          </div>
        </dl>

        {!complete && <p className="field__hint">Choose: {missing.map((m) => m.name).join(', ')}</p>}
        {complete && max === 0 && <p className="error">That choice is out of stock.</p>}

        <button className="btn btn--outline btn--block" onClick={addLine} disabled={!canBuy} style={{ marginBottom: '0.5rem' }}>
          Add to cart
        </button>
        {added && (
          <p className="notice notice--protected" role="status">
            Added to your cart. <Link className="link" to="/cart">View cart</Link>
          </p>
        )}
        <button className="btn btn--lg btn--block" onClick={buyNow} disabled={!canBuy}>
          Buy now
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
