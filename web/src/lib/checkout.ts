/**
 * What is being checked out: one or more lines from ONE seller (blueprint 22.3:
 * multi-seller checkout is undecided, so the cart splits by seller). Prices
 * here are for display only; the server prices the order.
 */
export interface CheckoutLine {
  productId: string;
  slug: string;
  title: string;
  brand?: string;
  priceMinor: string;
  currency: string;
  quantity: number;
  variant: Record<string, string>;
}

export interface CheckoutDraft {
  sellerId: string;
  source: 'buy-now' | 'cart';
  lines: CheckoutLine[];
}

const KEY = 'buybridge.checkout';
let mem: CheckoutDraft | null = null;

export function saveDraft(draft: CheckoutDraft) {
  mem = draft;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* the in-memory copy still works for this page view */
  }
}

export function loadDraft(): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as CheckoutDraft;
  } catch {
    /* fall through */
  }
  return mem;
}

export function clearDraft() {
  mem = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
