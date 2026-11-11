import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { BrandMark } from './components/BrandMark';
import { SiteMenu } from './components/SiteMenu';
import { useAccount } from './lib/account';
import { useCart } from './lib/cart';
import GetStartedPage from './pages/GetStartedPage';
import HomePage from './pages/HomePage';
import MyOrdersPage from './pages/MyOrdersPage';
import ProductPage from './pages/ProductPage';
import OrderStatusPage from './pages/OrderStatusPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import SellerNewProductPage from './pages/SellerNewProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import AdminSellersPage from './pages/AdminSellersPage';
import SellerFundsPage from './pages/SellerFundsPage';
import AdminPayoutsPage from './pages/AdminPayoutsPage';
import AdminReconciliationPage from './pages/AdminReconciliationPage';
import SignInPage from './pages/SignInPage';
import AdminDisputesPage from './pages/AdminDisputesPage';
import AdminDisputePage from './pages/AdminDisputePage';
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
  const { count } = useCart();

  return (
    <div className="shell">
      <ScrollToHash />
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="BuyBridge home">
          <BrandMark size={30} />
          <span className="brand__name">BuyBridge</span>
        </NavLink>
        <div className="topbar__actions">
          <Link className="cartlink" to="/cart" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 4h2l2.4 11h10.2L20 7H6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="19" r="1.5" fill="currentColor" /><circle cx="17" cy="19" r="1.5" fill="currentColor" /></svg>
            {count > 0 && <span className="cartlink__n">{count}</span>}
          </Link>
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
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/get-started" element={<GetStartedPage />} />
          <Route path="/orders" element={<MyOrdersPage />} />
          <Route path="/start-selling" element={<StartSellingPage />} />
          <Route path="/p/:slug" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/admin/sellers" element={<AdminSellersPage />} />
          <Route path="/admin/disputes" element={<AdminDisputesPage />} />
          <Route path="/admin/disputes/:disputeId" element={<AdminDisputePage />} />
          <Route path="/orders/:orderId" element={<OrderStatusPage />} />
          <Route path="/seller" element={<SellerDashboardPage />} />
          <Route path="/seller/funds" element={<SellerFundsPage />} />
          <Route path="/admin/reconciliation" element={<AdminReconciliationPage />} />
          <Route path="/admin/payouts" element={<AdminPayoutsPage />} />
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
