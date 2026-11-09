import { useCallback, useEffect, useState } from 'react';
import { createUser, getUser, type User } from '../api/users';

/**
 * TEMPORARY account stand-in (no real auth yet; see backend/README.md).
 * One user row per browser. Its id is stored under both role keys so the
 * existing buyer/seller pages (useDevIdentity) keep working unchanged.
 * Returning users on a new browser can't sign in until real auth exists.
 */
const KEYS = ['pandaspay.dev.buyerUserId', 'pandaspay.dev.sellerUserId'];
const EVENT = 'buybridge:account';

function readId(): string | null {
  try {
    return KEYS.map((k) => localStorage.getItem(k)).find(Boolean) ?? null;
  } catch {
    return null;
  }
}

export async function registerAccount(input: {
  fullName: string;
  email: string;
  phone?: string;
  role: 'buyer' | 'seller';
}): Promise<User> {
  const user = await createUser({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone || undefined,
    roles: [input.role.toUpperCase()],
  });
  try {
    KEYS.forEach((k) => localStorage.setItem(k, user.id));
  } catch {
    /* storage unavailable: account works for this page view only */
  }
  window.dispatchEvent(new Event(EVENT));
  return user;
}

export function signOutAccount() {
  try {
    KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const id = readId();
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

  return { user, loading };
}
