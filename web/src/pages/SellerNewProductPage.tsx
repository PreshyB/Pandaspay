import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';

export default function SellerNewProductPage() {
  const { user: seller, loading, createIdentity } = useDevIdentity('seller');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [created, setCreated] = useState<{ title: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateProduct() {
    setError(null);
    setSubmitting(true);
    try {
      let sellerId = seller?.id;
      if (!sellerId) {
        const createdSeller = await createIdentity({ email, fullName: name });
        sellerId = createdSeller.id;
      }
      const priceMinor = Math.round(Number(price) * 100).toString();
      const product = await api.createProduct({ sellerId, title, description, priceMinor, stockQuantity: Number(stock) });
      setCreated({ title: product.title ?? title, link: `${window.location.origin}/p/${product.slug}` });
      setCopied(false);
      setTitle('');
      setDescription('');
      setPrice('');
      setStock('1');
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

  const priceNumber = Number(price);
  const hasPrice = price !== '' && Number.isFinite(priceNumber) && priceNumber > 0;

  return (
    <div className="composer">
      <div>
        <div className="composer__intro page-head">
          <h1>List a product</h1>
          <p>Add the details once. You get a link to share on WhatsApp, Instagram, Facebook or TikTok.</p>
        </div>

        {!seller && !loading && (
          <fieldset className="group">
            <legend>Your details</legend>
            <div className="field">
              <label htmlFor="sname">Your name</label>
              <input id="sname" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="semail">Your email</label>
              <input id="semail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
          </fieldset>
        )}

        <fieldset className="group">
          <legend>Product</legend>
          <div className="field">
            <label htmlFor="title">Product title</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ankara fabric, 6 yards" />
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

        {error && <p className="error">{error}</p>}

        <button
          className="btn btn--lg"
          disabled={submitting || !title || !price || (!seller && (!name || !email))}
          onClick={handleCreateProduct}
        >
          {submitting ? 'Creating link…' : 'Create link'}
        </button>
      </div>

      <aside className="preview" aria-label="Preview">
        <h2>What buyers will see</h2>
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
