import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import type { User } from '../api/types';

/**
 * TEMPORARY stand-in for real auth, which isn't built yet (see
 * backend/README.md — "What's deliberately not built yet"). Mirrors
 * web/src/lib/useDevIdentity.ts but backed by AsyncStorage instead of
 * localStorage. Persists one dev-chosen identity per device, keyed by
 * role, so the buyer and seller flows can be exercised end-to-end
 * against the real API before a login system exists. Delete this the
 * moment auth lands.
 */
export function useDevIdentity(role: 'buyer' | 'seller') {
  const storageKey = `pandaspay.dev.${role}UserId`;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await AsyncStorage.getItem(storageKey);
      if (!id) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const fetched = await api.getUser(id);
        if (!cancelled) setUser(fetched);
      } catch {
        await AsyncStorage.removeItem(storageKey);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const createIdentity = useCallback(
    async (input: { email: string; fullName: string }) => {
      const created = await api.createUser({ ...input, roles: [role.toUpperCase()] });
      await AsyncStorage.setItem(storageKey, created.id);
      setUser(created);
      return created;
    },
    [role, storageKey],
  );

  const clearIdentity = useCallback(async () => {
    await AsyncStorage.removeItem(storageKey);
    setUser(null);
  }, [storageKey]);

  return { user, loading, createIdentity, clearIdentity };
}
