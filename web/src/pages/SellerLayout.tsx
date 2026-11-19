import { Link, NavLink, Outlet } from 'react-router-dom';
import { useDevIdentity } from '../lib/useDevIdentity';

const NAV: Array<{ to: string; label: string; end?: boolean; icon: string }> = [
  { to: '/seller', label: 'Overview', end: true, icon: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { to: '/seller/orders', label: 'Orders', icon: 'M6 3h12l2 4v13H4V7zM4 7h16M9 11h6' },
  { to: '/seller/products', label: 'Products', icon: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10' },
  { to: '/seller/funds', label: 'Sales & payouts', icon: 'M3 6h18v12H3zM3 10h18M7 15h3' },
  { to: '/seller/delivery', label: 'Delivery', icon: 'M2 7h11v9H2zM13 10h4l3 3v3h-7M6 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z' },
];

/** The seller workspace: one side menu around every seller screen. Web only. */
export default function SellerLayout() {
  const { user: seller, loading } = useDevIdentity('seller');

  if (loading) return <p className="muted">Loading…</p>;
  if (!seller) {
    return (
      <div className="card empty">
        <h1>Start selling first</h1>
        <p>Seller tools are part of your one PayTight account. Switch them on to open your dashboard.</p>
        <Link className="btn" to="/start-selling">
          Start selling
        </Link>
      </div>
    );
  }

  return (
    <div className="sd">
      <aside className="sd__side" aria-label="Seller menu">
        <div className="sd__who">
          <span className="sd__avatar" aria-hidden="true">{seller.fullName.trim().charAt(0).toUpperCase()}</span>
          <div>
            <strong>{seller.fullName}</strong>
            <span>Seller workspace</span>
          </div>
        </div>
        <nav className="sd__nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `sd__link${isActive ? ' sd__link--on' : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={n.icon} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <Link className="btn btn--block sd__cta" to="/seller/new-product">
          + List a product
        </Link>
      </aside>
      <div className="sd__body">
        <Outlet />
      </div>
    </div>
  );
}
