import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signOutAccount, useAccount } from '../lib/account';

/** Dropdown site menu: disclosure button + panel of links. Closes on Escape, outside click and navigation. */
export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const location = useLocation();
  const { user, isAdmin } = useAccount();

  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="menu__btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="menu__icon" aria-hidden="true" />
        Menu
      </button>

      {open && (
        <div className="menu__panel" id={panelId}>
          <p className="menu__group">Learn</p>
          <Link className="menu__item" to="/#how">
            How BuyBridge works
          </Link>
          <Link className="menu__item" to="/#safety">
            Safety and disputes
          </Link>
          <Link className="menu__item" to="/#faq">
            Questions
          </Link>

          <div className="menu__sep" />
          <p className="menu__group">Buying</p>
          {!user && (
            <Link className="menu__item" to="/get-started">
              Create your account
            </Link>
          )}
          <Link className="menu__item" to="/#find">
            Enter a product code
          </Link>
          <Link className="menu__item" to="/cart">
            Cart
          </Link>
          <Link className="menu__item" to="/orders">
            My orders
          </Link>

          <div className="menu__sep" />
          <p className="menu__group">Selling</p>
          <Link className="menu__item" to="/start-selling">
            Start selling
          </Link>
          <Link className="menu__item" to="/seller/delivery">
            Delivery and shipping
          </Link>
          <Link className="menu__item" to="/seller/new-product">
            List a product
          </Link>
          <Link className="menu__item" to="/seller">
            Seller dashboard
          </Link>
          <Link className="menu__item" to="/seller/funds">
            Sales and payouts
          </Link>

          {(isAdmin || !user) && (
            <>
              <div className="menu__sep" />
              <p className="menu__group">Admin{user ? '' : ' (test)'}</p>
              <Link className="menu__item" to="/admin/sellers">
                Seller applications
              </Link>
              <Link className="menu__item" to="/admin/payouts">
                Payout requests
              </Link>
              <Link className="menu__item" to="/admin/reconciliation">
                Reconciliation
              </Link>
              <Link className="menu__item" to="/admin/disputes">
                Disputes
              </Link>
            </>
          )}

          {!user && (
            <>
              <div className="menu__sep" />
              <Link className="menu__item" to="/sign-in">
                Sign in
              </Link>
            </>
          )}

          {user && (
            <>
              <div className="menu__sep" />
              <p className="menu__group">Signed in as {user.fullName}</p>
              <button type="button" className="menu__item" onClick={signOutAccount}>
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
