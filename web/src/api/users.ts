import { authHeaders } from '../lib/session';

export interface SellerApplication {
  businessName: string;
  socialLink?: string;
  note?: string;
  submittedAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  sellerStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  sellerApplication?: SellerApplication | null;
  sellerReviewNote?: string | null;
  storeState?: string | null;
  storeCity?: string | null;
}

const BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`;

async function failure(res: Response, fallback: string): Promise<Error> {
  try {
    const parsed = (await res.json()) as { message?: string | string[] };
    if (parsed.message) return new Error(Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message);
  } catch {
    /* not JSON */
  }
  return new Error(fallback);
}

export async function createUser(input: { email: string; fullName: string; phone?: string }): Promise<User> {
  const res = await fetch(`${BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (res.status === 409) throw new Error('An account with this email already exists. Sign in instead.');
  if (!res.ok) throw new Error('We could not create your account. Please try again.');
  return res.json();
}

export async function getUser(id: string): Promise<User> {
  const res = await fetch(`${BASE}/users/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function requestCode(email: string): Promise<{ sent: true; devCode?: string }> {
  const res = await fetch(`${BASE}/auth/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw await failure(res, 'We could not send a code. Try again.');
  return res.json();
}

export async function verifyCode(email: string, code: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) throw await failure(res, 'That code is not right or has expired.');
  return res.json();
}

export async function getMe(): Promise<User | null> {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders() });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? (JSON.parse(text) as User | null) : null;
}

export async function applyToSell(input: {
  businessName: string;
  socialLink?: string;
  note?: string;
  storeState: string;
  storeCity?: string;
  userId?: string;
}): Promise<User> {
  const res = await fetch(`${BASE}/sellers/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await failure(res, 'We could not send your application.');
  return res.json();
}

export async function listSellerApplications(status: string): Promise<User[]> {
  const res = await fetch(`${BASE}/sellers/applications?status=${status}`, { headers: authHeaders() });
  if (!res.ok) throw await failure(res, 'Could not load applications.');
  return res.json();
}

export async function reviewSeller(id: string, decision: 'approve' | 'reject', reason?: string): Promise<User> {
  const res = await fetch(`${BASE}/sellers/${id}/${decision}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw await failure(res, 'That decision could not be saved.');
  return res.json();
}
