import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { getUser } from '../api/users';
import { lineKey, removeLines, updateLine, useCart, type CartLine } from '../lib/cart';
import { saveDraft } from '../lib/checkout';
import { formatMoney } from '../lib/money';

export default function CartPage() {
  const navigate = useNavigate();
  const { lines } = useCart();
  const [names, setNames] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [chosenSeller, setChosenSeller] = useState<string | null>(null);

  // Refresh stock and price from the server so the cart never shows stale promises.
  useEffect(() => {
    const slugs = Array.from(new Set(lines.map((l) => l.slug)));
    slugs.forEach((slug) => {
      api
        .getProductBySlug(slug)
        .then((p) => {
          lines
            .filter((l) => l.slug === slug)
            .forEach((l) => {
              const sku = (p.skus ?? []).find((s) => Object.entries(l.variant).every(([k, v]) => s.attributes[k] === v));
              const available = p.skus?.length ? sku?.stockQuantity ?? 0 : p.stockQuantity || l.maxQty;
              const key = lineKey(l);
              if (available !== l.maxQty || p.priceMinor !== l.priceMinor) {
                const next = Math.min(l.quantity, available);
                if (next !== l.quantity) {
                  setNotes((n) => ({
                    ...n,
                    [key]:
                      available === 0
                        ? 'This choice is now out of stock. Nothing was charged.'
                        : `Only ${available} available, so your quantity changed from ${l.quantity} to ${next}. Nothing was charged.`,
                  }));
                }
                updateLine(key, { maxQty: available, quantity: Math.max(next, available === 0 ? l.quantity : 1), priceMinor: p.priceMinor });
              }
            });
        })
        .catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

  const sellerIds = useMemo(() => Array.from(new Set(lines.map((l) => l.sellerId))), [lines]);

  useEffect(() => {
    sellerIds.forEach((id) => {
      if (names[id]) return;
      getUser(id)
        .then((u) => setNames((n) => ({ ...n, [id]: u.fullName })))
        .catch(() => undefined);
    });
  }, [sellerIds, names]);

  if (lines.length === 0) {
    return (
      <div className="card empty">
        <h1>Your cart is empty</h1>
        <p>Open a seller's product link, choose your options, and add it here.</p>
        <Link className="btn" to="/#find">
          Enter a product code
        </Link>
      </div>
    );
  }

  const active = chosenSeller && sellerIds.includes(chosenSeller) ? chosenSeller : sellerIds[0];
  const activeLines = lines.filter((l) => l.sellerId === active);
  const otherLines = lines.filter((l) => l.sellerId !== active);
  const total = (ls: CartLine[]) => ls.reduce((n, l) => n + BigInt(l.priceMinor) * BigInt(l.quantity), BigInt(0));
  const sellerName = (id: string) => names[id] ?? 'this seller';
  const blocked = activeLines.some((l) => l.maxQty === 0);

  function row(l: CartLine) {
    const key = lineKey(l);
    const choices = Object.entries(l.variant).map(([k, v]) => `${k}: ${v}`).join(' · ');
    return (
      <div key={key} className="cartline">
        <div>
          <Link to={`/p/${l.slug}`} className="cartline__t">
            {l.title}
          </Link>
          <p className="muted" style={{ margin: 0 }}>
            {l.brand ? `${l.brand} · ` : ''}
            {choices || 'No options'}
          </p>
          {notes[key] && <p className="notice notice--amber">{notes[key]}</p>}
        </div>
        <div className="stepper-q">
          <button className="btn btn--outline btn--sm" aria-label="One fewer" disabled={l.quantity <= 1} onClick={() => updateLine(key, { quantity: l.quantity - 1 })}>
            –
          </button>
          <span aria-live="polite">{l.quantity}</span>
          <button className="btn btn--outline btn--sm" aria-label="One more" disabled={l.maxQty > 0 && l.quantity >= l.maxQty} onClick={() => updateLine(key, { quantity: l.quantity + 1 })}>
            +
          </button>
        </div>
        <b>{formatMoney((BigInt(l.priceMinor) * BigInt(l.quantity)).toString(), l.currency)}</b>
        <button className="linkbtn" onClick={() => removeLines([key])}>
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="co">
      <div>
        <div className="page-head">
          <h1>Your cart</h1>
        </div>

        {sellerIds.length > 1 && (
          <div className="notice notice--amber">
            <strong>Your cart has items from {sellerIds.length} sellers.</strong> Each order goes to one seller, so check out one seller at
            a time. The rest stay in your cart.
          </div>
        )}

        {sellerIds.length > 1 && (
          <fieldset className="choices">
            <legend>Check out now</legend>
            {sellerIds.map((id) => (
              <label key={id} className={`dopt${active === id ? ' dopt--on' : ''}`}>
                <input type="radio" name="seller" checked={active === id} onChange={() => setChosenSeller(id)} />
                <span>
                  {sellerName(id)}'s items only
                  <small>{lines.filter((l) => l.sellerId === id).length} item(s)</small>
                </span>
              </label>
            ))}
            <label className="dopt dopt--off">
              <input type="radio" disabled />
              <span>
                Everything together<small>Not supported yet</small>
              </span>
            </label>
          </fieldset>
        )}

        <div className="cartlist">{activeLines.map(row)}</div>

        {otherLines.length > 0 && (
          <>
            <h2 className="cart__other">Stays in your cart</h2>
            <div className="cartlist cartlist--rest">{otherLines.map(row)}</div>
          </>
        )}
      </div>

      <aside className="buybox" aria-label="Cart summary">
        <h2>Summary</h2>
        <dl className="sum">
          <div>
            <dt>{activeLines.length} item(s) from {sellerName(active)}</dt>
            <dd>{formatMoney(total(activeLines).toString(), activeLines[0].currency)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd className="muted">At checkout</dd>
          </div>
        </dl>
        {blocked && <p className="error">Remove the out-of-stock item to continue.</p>}
        <button
          className="btn btn--lg btn--block"
          disabled={blocked}
          onClick={() => {
            saveDraft({
              sellerId: active,
              source: 'cart',
              lines: activeLines.map(({ productId, slug, title, brand, priceMinor, currency, quantity, variant }) => ({
                productId, slug, title, brand, priceMinor, currency, quantity, variant,
              })),
            });
            navigate('/checkout');
          }}
        >
          Go to checkout
        </button>
        <p className="gs__fine">The final amount is calculated by BuyBridge when you place the order.</p>
      </aside>
    </div>
  );
}
