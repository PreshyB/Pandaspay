import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { User } from '../api/types';
import { getToken, hydrateSession, setToken, subscribeSession } from './session';

/**
 * The signed-in account on this phone (same idea as web/src/lib/account.ts). Signing in uses
 * an emailed one-time code; the token is kept in session.ts. Everyone is a buyer, and selling
 * switches on only when an admin approves a seller application.
 */
export function useAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    api
      .getMe()
      .then((u) => setUser(u ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void hydrateSession().then(load);
    return subscribeSession(load);
  }, [load]);

  const roles = user?.roles ?? [];
  return {
    user,
    loading,
    isSeller: roles.includes('SELLER'),
    sellerStatus: user?.sellerStatus ?? 'NONE',
    refresh: load,
    signOut: () => setToken(null),
  };
}

/** Kept so existing screens keep their shape: 'seller' only yields a user once an admin has approved them. */
export function useDevIdentity(role: 'buyer' | 'seller') {
  const { user, loading, isSeller } = useAccount();
  return { user: role === 'seller' && !isSeller ? null : user, loading };
}
