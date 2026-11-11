import { useCallback, useEffect, useState } from 'react';
import type { CheckoutLine } from './checkout';

/** A cart line is a checkout line plus who sells it and how many are available (as last seen). */
export interface CartLine extends CheckoutLine {
  sellerId: string;
  maxQty: number;
}

const KEY = 'buybridge.cart';
const EVENT = 'buybridge:cart';

export const lineKey = (l: Pick<CartLine, 'productId' | 'variant'>) =>
  `${l.productId}|${Object.keys(l.variant).sort().map((k) => `${k}=${l.variant[k]}`).join('&')}`;

export function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart(line: CartLine) {
  const cart = readCart();
  const existing = cart.find((l) => lineKey(l) === lineKey(line));
  if (existing) {
    existing.quantity = Math.min(existing.quantity + line.quantity, line.maxQty || existing.quantity + line.quantity);
    existing.maxQty = line.maxQty;
    existing.priceMinor = line.priceMinor;
  } else {
    cart.push(line);
  }
  write(cart);
}

export function updateLine(key: string, patch: Partial<CartLine>) {
  write(readCart().map((l) => (lineKey(l) === key ? { ...l, ...patch } : l)));
}

export function removeLines(keys: string[]) {
  write(readCart().filter((l) => !keys.includes(lineKey(l))));
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>(() => readCart());
  const sync = useCallback(() => setLines(readCart()), []);
  useEffect(() => {
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [sync]);
  return { lines, count: lines.reduce((n, l) => n + l.quantity, 0) };
}
