import { NavLink, Route, Routes } from 'react-router-dom';
import { BrandMark } from './components/BrandMark';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import OrderStatusPage from './pages/OrderStatusPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import SellerNewProductPage from './pages/SellerNewProductPage';

export default function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="BuyBridge home">
          <BrandMark size={30} />
          <span className="brand__name">BuyBridge</span>
        </NavLink>
        <nav className="topbar__nav" aria-label="Seller">
          <NavLink to="/seller" end>
            Seller dashboard
          </NavLink>
          <NavLink to="/seller/new-product">List a product</NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/p/:slug" element={<ProductPage />} />
          <Route path="/orders/:orderId" element={<OrderStatusPage />} />
          <Route path="/seller" element={<SellerDashboardPage />} />
          <Route path="/seller/new-product" element={<SellerNewProductPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <span>BuyBridge holds your payment until delivery is confirmed.</span>
        <span>Test mode: payments are simulated and no real money moves.</span>
      </footer>
    </div>
  );
}
