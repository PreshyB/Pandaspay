import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Product } from '../api/types';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';

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
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const { user: buyer, loading: identityLoading, createIdentity } = useDevIdentity('buyer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    api
      .getProductBySlug(slug)
      .then(setProduct)
      .catch(() => setError('Product not found. Check the link and try again.'));
  }, [slug]);

  async function handleBuyNow() {
    if (!product) return;
    setError(null);
    setPlacing(true);
    try {
      let buyerId = buyer?.id;
      if (!buyerId) {
        const created = await createIdentity({ email, fullName: name });
        buyerId = created.id;
      }
      const { order } = await api.createOrder({
        buyerId,
        sellerId: product.sellerId,
        items: [{ productId: product.id, quantity }],
      });
      navigate(`/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place the order. Try again.');
    } finally {
      setPlacing(false);
    }
  }

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

  return (
    <div className="product">
      <div>
        <h1>{product.title}</h1>
        <p className="product__price">{formatMoney(product.priceMinor, product.currency)}</p>
        <p className="muted">{product.stockQuantity} in stock</p>
        <p className="product__desc">{product.description || 'The seller has not added a description.'}</p>
      </div>

      <aside className="buybox" aria-label="Buy this product">
        <div className="field">
          <label htmlFor="qty">Quantity</label>
          <input
            id="qty"
            type="number"
            min={1}
            max={product.stockQuantity || 99}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
          />
        </div>

        {!buyer && !identityLoading && (
          <>
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="email">Your email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <button
          className="btn btn--lg btn--block"
          onClick={handleBuyNow}
          disabled={placing || (!buyer && (!name || !email))}
        >
          {placing ? 'Placing order…' : 'Buy with protection'}
        </button>

        <ul className="assure">
          <li>
            <Tick />
            You pay BuyBridge, not the seller.
          </li>
          <li>
            <Tick />
            The seller ships once your payment is held.
          </li>
          <li>
            <Tick />
            The seller is paid after you confirm delivery.
          </li>
        </ul>
      </aside>
    </div>
  );
}
