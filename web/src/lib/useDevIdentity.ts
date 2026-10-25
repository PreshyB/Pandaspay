import { useCallback, useEffect, useState } from 'react';
import { createUser, getUser, type User } from '../api/users';

/**
 * TEMPORARY stand-in for real auth, which isn't built yet (see
 * backend/README.md — "What's deliberately not built yet"). Persists a
 * single dev-chosen identity per browser in localStorage, keyed by role,
 * so the buyer and seller flows can be exercised end-to-end against the
 * real API before a login system exists. Delete this the moment auth
 * lands; nothing downstream should depend on localStorage for identity.
 */
export function useDevIdentity(role: 'buyer' | 'seller') {
  const storageKey = `pandaspay.dev.${role}UserId`;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem(storageKey);
    if (!id) {
      setLoading(false);
      return;
    }
    getUser(id)
      .then(setUser)
      .catch(() => localStorage.removeItem(storageKey))
      .finally(() => setLoading(false));
  }, [storageKey]);

  const createIdentity = useCallback(
    async (input: { email: string; fullName: string }) => {
      const created = await createUser({ ...input, roles: [role.toUpperCase()] });
      localStorage.setItem(storageKey, created.id);
      setUser(created);
      return created;
    },
    [role, storageKey],
  );

  const clearIdentity = useCallback(() => {
    localStorage.removeItem(storageKey);
    setUser(null);
  }, [storageKey]);

  return { user, loading, createIdentity, clearIdentity };
}
