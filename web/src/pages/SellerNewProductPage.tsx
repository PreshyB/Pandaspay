import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';

export default function SellerNewProductPage() {
  const { user: seller, loading } = useDevIdentity('seller');
  const [hasDelivery, setHasDelivery] = useState<boolean | null>(null);
  const [brand, setBrand] = useState('');
  const [optRows, setOptRows] = useState<Array<{ name: string; values: string }>>([{ name: '', values: '' }]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [created, setCreated] = useState<{ title: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!seller) return;
    api
      .getSellerDelivery(seller.id)
      .then((d) => setHasDelivery(d.options.some((o) => o.isActive)))
      .catch(() => setHasDelivery(false));
  }, [seller]);

  async function handleCreateProduct() {
    setError(null);
    setSubmitting(true);
    try {
      if (!seller) throw new Error('Start selling first.');
      const sellerId = seller.id;
      const options = optRows
        .map((r) => ({ name: r.name.trim(), values: r.values.split(',').map((v) => v.trim()).filter(Boolean) }))
        .filter((r) => r.name && r.values.length > 0);
      const priceMinor = Math.round(Number(price) * 100).toString();
      const product = await api.createProduct({ sellerId, title, description, priceMinor, stockQuantity: Number(stock), brand: brand.trim() || undefined, options });
      setCreated({ title: product.title ?? title, link: `${window.location.origin}/p/${product.slug}` });
      setCopied(false);
      setTitle('');
      setDescription('');
      setPrice('');
      setStock('1');
      setBrand('');
      setOptRows([{ name: '', values: '' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the product.');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (created) {
    const whatsappText = encodeURIComponent(`${created.title}\n${created.link}`);
    return (
      <div className="share">
        <h1>Your link is ready</h1>
        <p>Share it in a chat or post. Buyers who open it can pay with protection.</p>
        <a className="share__link" href={created.link}>
          {created.link}
        </a>
        <div className="row">
          <button className="btn" onClick={copyLink}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <a
            className="btn btn--secondary"
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on WhatsApp
          </a>
          <button className="btn btn--outline" onClick={() => setCreated(null)}>
            List another product
          </button>
        </div>
        <p className="muted" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
          When someone buys, the order appears on your <Link className="link" to="/seller">seller dashboard</Link>.
        </p>
      </div>
    );
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!seller) {
    return (
      <div className="card empty">
        <h1>Start selling first</h1>
        <p>Seller tools are part of your one BuyBridge account. Switch them on to list a product.</p>
        <Link className="btn" to="/start-selling">
          Start selling
        </Link>
      </div>
    );
  }

  if (hasDelivery === null) return <p className="muted">Loading…</p>;
  if (!hasDelivery) {
    return (
      <div className="card empty">
        <h1>Set up delivery first</h1>
        <p>
          Buyers need to know what delivery costs and when it arrives, so add at least one delivery zone before you list a product.
        </p>
        <Link className="btn" to="/seller/delivery">
          Set up delivery
        </Link>
      </div>
    );
  }

  const priceNumber = Number(price);
  const hasPrice = price !== '' && Number.isFinite(priceNumber) && priceNumber > 0;

  return (
    <div className="composer">
      <div>
        <div className="composer__intro page-head">
          <h1>List a product</h1>
          <p>Add the details once. You get a link to share on WhatsApp, Instagram, Facebook or TikTok.</p>
        </div>

        <fieldset className="group">
          <legend>Product</legend>
          <div className="field">
            <label htmlFor="title">Product title</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ankara fabric, 6 yards" />
          </div>
          <div className="field">
            <label htmlFor="brand">
              Brand <span className="field__hint">(optional)</span>
            </label>
            <input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Nike" />
          </div>
          <div className="field">
            <label htmlFor="desc">Description</label>
            <textarea
              id="desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Size, colour, condition, delivery areas"
            />
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="field">
              <label htmlFor="price">Price (NGN)</label>
              <input id="price" type="number" min={0} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="15000" />
            </div>
            <div className="field">
              <label htmlFor="stock">Stock</label>
              <input id="stock" type="number" min={1} value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>Choices for the buyer</legend>
          <p className="field__hint" style={{ marginTop: 0 }}>
            Colour, size, model... Separate the values with commas. Buyers must pick one of each before checkout.
          </p>
          {optRows.map((row, i) => (
            <div className="row" key={i} style={{ alignItems: 'flex-start' }}>
              <div className="field">
                <label htmlFor={`on-${i}`}>Choice</label>
                <input
                  id={`on-${i}`}
                  value={row.name}
                  onChange={(e) => setOptRows((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  placeholder="Colour"
                />
              </div>
              <div className="field">
                <label htmlFor={`ov-${i}`}>Values</label>
                <input
                  id={`ov-${i}`}
                  value={row.values}
                  onChange={(e) => setOptRows((rows) => rows.map((r, j) => (j === i ? { ...r, values: e.target.value } : r)))}
                  placeholder="Black, White, Red"
                />
              </div>
            </div>
          ))}
          {optRows.length < 4 && (
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setOptRows((rows) => [...rows, { name: '', values: '' }])}>
              Add another choice
            </button>
          )}
          <p className="field__hint">Stock is counted for the whole product for now, not per colour or size.</p>
        </fieldset>

        {error && <p className="error">{error}</p>}

        <button
          className="btn btn--lg"
          disabled={submitting || !title || !price}
          onClick={handleCreateProduct}
        >
          {submitting ? 'Creating link…' : 'Create link'}
        </button>
      </div>

      <aside className="preview" aria-label="Preview">
        <h2>What buyers will see</h2>
        {brand && <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>{brand}</p>}
        <p className={`preview__title${title ? '' : ' preview__title--empty'}`}>{title || 'Your product title'}</p>
        <p className={`preview__price${hasPrice ? '' : ' preview__price--empty'}`}>
          {hasPrice ? formatMoney(Math.round(priceNumber * 100), 'NGN') : 'Set a price'}
        </p>
        <p className="muted">{stock || 0} in stock</p>
        <p className="preview__desc">{description || 'Your description appears here.'}</p>
      </aside>
    </div>
  );
}
