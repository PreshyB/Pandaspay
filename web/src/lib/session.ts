/** The sign-in token for this browser. Sent as a bearer token on every API call. */
const KEY = 'buybridge.token';
export const SESSION_EVENT = 'buybridge:account';

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: signed in for this page view only */
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
