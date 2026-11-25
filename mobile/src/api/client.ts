import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { authHeaders } from '../lib/session';
import type { CreateOrderResponse, Order, OrderWithPayment, Product, User } from './types';

/**
 * Where the backend is. On a real phone "localhost" is the phone itself, so the address is
 * worked out in this order:
 *   1. EXPO_PUBLIC_API_BASE_URL (set it in mobile/.env for a deployed or tunnelled backend)
 *   2. expo.extra.apiBaseUrl in app.json, if filled in
 *   3. the computer running `expo start`: Expo Go already knows its address, and the backend
 *      runs on port 3000 on that same computer
 *   4. the Android emulator's alias for the host computer, or localhost (iOS simulator, web)
 */
function resolveBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const fromConfig = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  if (fromConfig) return fromConfig.replace(/\/$/, '');
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:3000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
}

export const API_BASE = resolveBase();

/** Product photos are public: the address can go straight into <Image source={{ uri }}>. */
export const imageUrl = (imageId: string) => `${API_BASE}/products/images/${imageId}`;

async function failure(res: Response, fallback: string): Promise<Error> {
  try {
    const parsed = (await res.json()) as { message?: string | string[] };
    if (parsed.message) return new Error(Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message);
  } catch {
    /* not JSON */
  }
  return new Error(fallback);
}

async function request<T>(path: string, init?: RequestInit, fallback = 'Something went wrong. Please try again.'): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) },
    });
  } catch {
    // fetch only throws when nothing answered at all.
    throw new Error(
      `Can't reach the PayTight server at ${API_BASE}. Check that the backend is running and that your phone is on the same Wi-Fi as your computer.`,
    );
  }
  if (!res.ok) throw await failure(res, res.status === 401 ? 'Please sign in to continue.' : fallback);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  getProductBySlug: (slug: string) => request<Product>(`/products/${slug}`),

  createProduct: (input: {
    sellerId: string;
    title: string;
    description?: string;
    priceMinor: string;
    stockQuantity?: number;
    brand?: string;
  }) => request<Product>('/products', { method: 'POST', body: JSON.stringify(input) }),

  createUser: (input: { email: string; fullName: string; phone?: string }) =>
    request<User>('/users', { method: 'POST', body: JSON.stringify(input) }, 'We could not create your account.'),

  requestCode: (email: string) =>
    request<{ sent: true; devCode?: string }>('/auth/request-code', { method: 'POST', body: JSON.stringify({ email }) }, 'We could not send a code.'),
  verifyCode: (email: string, code: string) =>
    request<{ token: string; user: User }>('/auth/verify', { method: 'POST', body: JSON.stringify({ email, code }) }, 'That code is not right or has expired.'),
  getMe: () => request<User | null>('/auth/me'),
  applyToSell: (input: { businessName: string; socialLink?: string; note?: string; storeState: string; storeCity?: string }) =>
    request<User>('/sellers/apply', { method: 'POST', body: JSON.stringify(input) }, 'We could not send your application.'),

  getUser: (id: string) => request<User>(`/users/${id}`),

  createOrder: (input: {
    buyerId: string;
    sellerId: string;
    items: { productId: string; quantity: number; variant?: Record<string, unknown> }[];
    deliveryOptionId?: string;
    deliveryAddress?: Record<string, unknown>;
  }) => request<CreateOrderResponse>('/orders', { method: 'POST', body: JSON.stringify(input) }),

  getOrder: (id: string) => request<OrderWithPayment>(`/orders/${id}`),

  listOrdersForSeller: (sellerId: string) =>
    request<OrderWithPayment[]>(`/orders?sellerId=${encodeURIComponent(sellerId)}`),

  listOrdersForBuyer: (buyerId: string) =>
    request<OrderWithPayment[]>(`/orders?buyerId=${encodeURIComponent(buyerId)}`),

  acceptOrder: (id: string) => request<Order>(`/orders/${id}/accept`, { method: 'PATCH' }),

  shipOrder: (id: string, waybillRef: string) =>
    request<Order>(`/orders/${id}/ship`, { method: 'PATCH', body: JSON.stringify({ waybillRef }) }),

  confirmDelivered: (id: string, confirmedBy: 'BUYER' | 'COURIER' | 'AUTO_TIMEOUT' = 'BUYER') =>
    request<Order>(`/orders/${id}/delivered`, { method: 'PATCH', body: JSON.stringify({ confirmedBy }) }),

  cancelOrder: (id: string, actorId: string) =>
    request<Order>(`/orders/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ actorId }) }),

  declineOrder: (id: string, actorId: string) =>
    request<Order>(`/orders/${id}/decline`, { method: 'PATCH', body: JSON.stringify({ actorId }) }),

  openDispute: (paymentId: string, openedById: string, reason: string, details?: string) =>
    request('/disputes', { method: 'POST', body: JSON.stringify({ paymentId, openedById, reason, details }) }),

  /** Dev-only helper: simulates the licensed partner's webhook confirming payment. */
  simulatePaymentConfirmed: (providerTransactionRef: string) =>
    request('/webhooks/palmpay', {
      method: 'POST',
      body: JSON.stringify({
        eventId: `dev-${providerTransactionRef}-${Date.now()}`,
        eventType: 'payment.confirmed',
        providerTransactionRef,
      }),
    }),
};
