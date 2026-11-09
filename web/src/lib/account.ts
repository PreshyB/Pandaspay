import { useCallback, useEffect, useState } from 'react';
import { createUser, getUser, type User } from '../api/users';

/**
 * TEMPORARY account stand-in (no real auth yet; see backend/README.md).
 *
 * Follows the blueprint's one-account model: signing up creates ONE user
 * with buyer capability. "Start selling" later switches seller tools on for
 * that same user (verification/KYC is not built yet, so activation is local
 * for now). The ids live under the keys the existing pages already read.
 * Returning users on a new browser can't sign in until real auth exists.
 */
const BUYER_KEY = 'pandaspay.dev.buyerUserId';
const SELLER_KEY = 'pandaspay.dev.sellerUserId';
const EVENT = 'buybridge:account';

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable: account works for this page view only */
  }
  window.dispatchEvent(new Event(EVENT));
}

export async function registerAccount(input: { fullName: string; email: string; phone?: string }): Promise<User> {
  const user = await createUser({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone || undefined,
    roles: ['BUYER'],
  });
  set(BUYER_KEY, user.id);
  return user;
}

/** Switch seller tools on for the signed-in account (test mode: no verification step yet). */
export function activateSelling(userId: string) {
  set(SELLER_KEY, userId);
}

export function signOutAccount() {
  try {
    localStorage.removeItem(BUYER_KEY);
    localStorage.removeItem(SELLER_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const id = get(BUYER_KEY) ?? get(SELLER_KEY);
    setIsSeller(!!id && get(SELLER_KEY) === id);
    if (!id) {
      setUser(null);
      setLoading(false);
      return;
    }
    getUser(id)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(EVENT, load);
    return () => window.removeEventListener(EVENT, load);
  }, [load]);

  return { user, isSeller, loading };
}
