import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const [slug, setSlug] = useState('');
  const navigate = useNavigate();

  return (
    <div>
      <h1>Buy with payment protection</h1>
      <p>
        Open a seller's product link below, or paste the product code a seller shared with you on WhatsApp,
        Instagram or TikTok.
      </p>
      <div className="card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (slug.trim()) navigate(`/p/${slug.trim()}`);
          }}
        >
          <div className="field">
            <label htmlFor="slug">Product code</label>
            <input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. a1b2c3d4" />
          </div>
          <button className="btn" type="submit">
            View product
          </button>
        </form>
      </div>
      <p className="muted" style={{ marginTop: '2rem' }}>
        Selling instead? Go to the{' '}
        <a href="/seller/new-product" style={{ color: 'var(--primary)' }}>
          seller dashboard
        </a>{' '}
        to list a product and get your shareable link.
      </p>
    </div>
  );
}
