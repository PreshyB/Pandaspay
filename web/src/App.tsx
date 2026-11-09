import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { BrandMark } from './components/BrandMark';
import { SiteMenu } from './components/SiteMenu';
import { useAccount } from './lib/account';
import GetStartedPage from './pages/GetStartedPage';
import HomePage from './pages/HomePage';
import MyOrdersPage from './pages/MyOrdersPage';
import ProductPage from './pages/ProductPage';
import OrderStatusPage from './pages/OrderStatusPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import SellerNewProductPage from './pages/SellerNewProductPage';
import CheckoutPage from './pages/CheckoutPage';
import SellerDeliveryPage from './pages/SellerDeliveryPage';
import StartSellingPage from './pages/StartSellingPage';

/** Scrolls to #section after navigation, and to the top on a plain page change. */
function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  const { user } = useAccount();

  return (
    <div className="shell">
      <ScrollToHash />
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="BuyBridge home">
          <BrandMark size={30} />
          <span className="brand__name">BuyBridge</span>
        </NavLink>
        <div className="topbar__actions">
          {user ? (
            <Link className="btn btn--sm btn--secondary" to="/orders">
              My orders
            </Link>
          ) : (
            <Link className="btn btn--sm" to="/get-started">
              Get started
            </Link>
          )}
          <SiteMenu />
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/get-started" element={<GetStartedPage />} />
          <Route path="/orders" element={<MyOrdersPage />} />
          <Route path="/start-selling" element={<StartSellingPage />} />
          <Route path="/p/:slug" element={<ProductPage />} />
          <Route path="/checkout/:slug" element={<CheckoutPage />} />
          <Route path="/orders/:orderId" element={<OrderStatusPage />} />
          <Route path="/seller" element={<SellerDashboardPage />} />
          <Route path="/seller/delivery" element={<SellerDeliveryPage />} />
          <Route path="/seller/new-product" element={<SellerNewProductPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <span>Payment protection follows BuyBridge's terms and doesn't cover every case.</span>
        <span>Test mode: payments are simulated and no real money moves.</span>
      </footer>
    </div>
  );
}
