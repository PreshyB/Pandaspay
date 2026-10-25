export interface User {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
}

const BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`;

export async function createUser(input: { email: string; fullName: string; roles?: string[] }): Promise<User> {
  const res = await fetch(`${BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getUser(id: string): Promise<User> {
  const res = await fetch(`${BASE}/users/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
