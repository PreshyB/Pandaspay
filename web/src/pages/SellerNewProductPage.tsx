import { useState } from 'react';
import { api } from '../api/client';
import { useDevIdentity } from '../lib/useDevIdentity';

export default function SellerNewProductPage() {
  const { user: seller, loading, createIdentity } = useDevIdentity('seller');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateProduct() {
    setError(null);
    setSubmitting(true);
    try {
      let sellerId = seller?.id;
      if (!sellerId) {
        const created = await createIdentity({ email, fullName: name });
        sellerId = created.id;
      }
      const priceMinor = Math.round(Number(price) * 100).toString();
      const product = await api.createProduct({ sellerId, title, description, priceMinor, stockQuantity: Number(stock) });
      setCreatedLink(`${window.location.origin}/p/${product.slug}`);
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

  return (
    <div>
      <h1>List a product</h1>
      <p>Create a product and get a unique link to share on WhatsApp, Instagram, Facebook or TikTok.</p>

      <div className="card">
        {!seller && !loading && (
          <>
            <div className="field">
              <label htmlFor="sname">Your name</label>
              <input id="sname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="semail">Your email</label>
              <input id="semail" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="title">Product title</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ankara fabric, 6 yards" />
        </div>
        <div className="field">
          <label htmlFor="desc">Description</label>
          <textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="price">Price (NGN)</label>
            <input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="15000" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="stock">Stock</label>
            <input id="stock" type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <button
          className="btn"
          disabled={submitting || !title || !price || (!seller && (!name || !email))}
          onClick={handleCreateProduct}
        >
          {submitting ? 'Creating…' : 'Create product & get link'}
        </button>

        {createdLink && (
          <p style={{ marginTop: '1rem' }}>
            Shareable link: <a href={createdLink}>{createdLink}</a>
          </p>
        )}
      </div>
    </div>
  );
}
