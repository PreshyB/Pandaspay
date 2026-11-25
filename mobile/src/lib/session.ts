import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The sign-in token for this phone. Held in memory for speed and saved to AsyncStorage so
 * the person stays signed in. Everything that needs to react to sign-in or sign-out
 * subscribes here.
 */
const KEY = 'paytight.token';

let token: string | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

export const getToken = () => token;

export function subscribeSession(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Reads the saved token once, at start-up. */
export async function hydrateSession() {
  if (hydrated) return;
  try {
    token = await AsyncStorage.getItem(KEY);
  } catch {
    token = null;
  }
  hydrated = true;
  listeners.forEach((fn) => fn());
}

export async function setToken(next: string | null) {
  token = next;
  hydrated = true;
  try {
    if (next) await AsyncStorage.setItem(KEY, next);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: signed in until the app closes */
  }
  listeners.forEach((fn) => fn());
}

export const authHeaders = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});
