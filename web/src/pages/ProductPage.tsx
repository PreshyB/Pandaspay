import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Product } from '../api/types';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';

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
      .catch(() => setError('Product not found — check the link and try again.'));
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

  if (error && !product) return <p className="error">{error}</p>;
  if (!product) return <p className="muted">Loading product…</p>;

  return (
    <div>
      <h1>{product.title}</h1>
      <p>{product.description || 'No description provided.'}</p>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong style={{ fontSize: '1.25rem' }}>{formatMoney(product.priceMinor, product.currency)}</strong>
          <span className="muted">{product.stockQuantity} in stock</span>
        </div>

        <div className="field" style={{ marginTop: '1.25rem' }}>
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
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="field">
              <label htmlFor="email">Your email</label>
              <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <button
          className="btn"
          onClick={handleBuyNow}
          disabled={placing || (!buyer && (!name || !email))}
        >
          {placing ? 'Placing order…' : 'Buy now — payment protected'}
        </button>
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Your payment is protected until delivery is confirmed.
        </p>
      </div>
    </div>
  );
}
