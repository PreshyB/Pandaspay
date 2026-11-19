import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, imageUrl } from '../api/client';
import type { Product } from '../api/types';
import { MAX_PHOTOS, shrinkImage } from '../lib/images';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';

const stockOf = (p: Product) => (p.skus?.length ? p.skus.reduce((n, s) => n + s.stockQuantity, 0) : p.stockQuantity);
const sorted = (p: Product) => [...(p.images ?? [])].sort((a, b) => a.position - b.position);

function PhotoManager({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photos = sorted(product);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  async function add(files: FileList | null) {
    if (!files?.length) return;
    await run(async () => {
      for (const f of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
        await api.uploadProductImage(product.id, await shrinkImage(f));
      }
    });
    if (input.current) input.current.value = '';
  }

  return (
    <div className="pm">
      <ul className="photos__grid">
        {photos.map((p, i) => (
          <li key={p.id} className="photos__item">
            <img src={imageUrl(p.id)} alt={`${product.title}, photo ${i + 1}`} loading="lazy" />
            {i === 0 && <span className="photos__cover">Cover</span>}
            <div className="photos__actions">
              {i > 0 && (
                <button type="button" disabled={busy} onClick={() => run(() => api.makeCoverImage(product.id, p.id))}>
                  Make cover
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => run(() => api.deleteProductImage(product.id, p.id))}>
                Remove
              </button>
            </div>
          </li>
        ))}
        {photos.length < MAX_PHOTOS && (
          <li>
            <button type="button" className="photos__add" disabled={busy} onClick={() => input.current?.click()}>
              <span aria-hidden="true">+</span>
              {busy ? 'Working…' : 'Add photos'}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void add(e.target.files)} />
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default function SellerProductsPage() {
  const { user: seller } = useDevIdentity('seller');
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!seller) return;
    api
      .listProductsBySeller(seller.id)
      .then(setProducts)
      .catch(() => setError('Could not load your products.'));
  }, [seller]);

  useEffect(load, [load]);

  async function copy(p: Product) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${p.slug}`);
      setCopied(p.id);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  if (!seller) return null;

  return (
    <div>
      <header className="sd__head">
        <div>
          <h1>Products</h1>
          <p className="muted">Everything you sell. Photos help buyers trust a listing, so add a few good ones.</p>
        </div>
        <Link className="btn" to="/seller/new-product">
          + List a product
        </Link>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        {products === null ? (
          <p className="muted panel__pad">Loading…</p>
        ) : products.length === 0 ? (
          <div className="panel__pad empty-state">
            <h3>No products yet</h3>
            <p className="muted">List your first product to get a link you can share in chats and posts.</p>
            <Link className="btn" to="/seller/new-product">
              List a product
            </Link>
          </div>
        ) : (
          <ul className="plist">
            {products.map((p) => {
              const photos = sorted(p);
              const stock = stockOf(p);
              const expanded = open === p.id;
              return (
                <li key={p.id} className="plist__item">
                  <div className="plist__row">
                    {photos[0] ? (
                      <img className="plist__img" src={imageUrl(photos[0].id)} alt="" loading="lazy" />
                    ) : (
                      <button className="plist__img plist__img--none" onClick={() => setOpen(p.id)} aria-label={`Add photos to ${p.title}`}>
                        Add photo
                      </button>
                    )}
                    <div className="plist__main">
                      <Link className="plist__title" to={`/p/${p.slug}`}>
                        {p.title}
                      </Link>
                      <span className="muted">
                        {formatMoney(p.priceMinor, p.currency)} · {photos.length} photo{photos.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <span className={`pill ${stock === 0 ? 'pill--alert' : stock <= 3 ? 'pill--amber' : 'pill--ok'}`}>
                      {stock === 0 ? 'Out of stock' : `${stock} in stock`}
                    </span>
                    <div className="plist__actions">
                      <button className="btn btn--sm btn--outline" onClick={() => copy(p)}>
                        {copied === p.id ? 'Copied' : 'Copy link'}
                      </button>
                      <button className="btn btn--sm btn--outline" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : p.id)}>
                        Photos
                      </button>
                    </div>
                  </div>
                  {expanded && <PhotoManager product={p} onChanged={load} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
