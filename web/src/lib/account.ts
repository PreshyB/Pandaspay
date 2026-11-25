import { useCallback, useEffect, useState } from 'react';
import { createUser, getMe, type User } from '../api/users';
import { getToken, SESSION_EVENT, setToken } from './session';

/**
 * Account state for this browser. One account per person (blueprint): everyone is a buyer,
 * and selling is switched on only when an admin approves a seller application, which adds
 * the SELLER role on the server. Signing in uses an emailed one-time code; the resulting
 * token lives in session.ts.
 */

/** Creates the account. The person still has to confirm their email with a code to sign in. */
export async function registerAccount(input: { fullName: string; email: string; phone?: string }): Promise<User> {
  return createUser({ fullName: input.fullName, email: input.email, phone: input.phone || undefined });
}

export function signInWithToken(token: string) {
  setToken(token);
}

export function signOutAccount() {
  setToken(null);
}

export function useAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(SESSION_EVENT, load);
    return () => window.removeEventListener(SESSION_EVENT, load);
  }, [load]);

  const roles = user?.roles ?? [];
  return {
    user,
    loading,
    isSeller: roles.includes('SELLER'),
    isAdmin: roles.includes('ADMIN'),
    sellerStatus: user?.sellerStatus ?? 'NONE',
    refresh: load,
  };
}
