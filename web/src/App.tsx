import { NavLink, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import OrderStatusPage from './pages/OrderStatusPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import SellerNewProductPage from './pages/SellerNewProductPage';

export default function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="topbar__mark">
          Pandas Pay
        </NavLink>
        <nav className="topbar__nav">
          <NavLink to="/seller">Seller dashboard</NavLink>
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
    </div>
  );
}
