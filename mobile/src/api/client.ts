import Constants from 'expo-constants';
import type { CreateOrderResponse, Order, OrderWithPayment, Product, User } from './types';

// Set via app.json -> expo.extra.apiBaseUrl (or EXPO_PUBLIC_API_BASE_URL
// at build time). No dev proxy exists on native the way Vite provides one
// for web, so the device/simulator must be able to reach this host
// directly — on a physical device that means your machine's LAN IP, not
// localhost.
const BASE =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getProductBySlug: (slug: string) => request<Product>(`/products/${slug}`),

  createProduct: (input: {
    sellerId: string;
    title: string;
    description?: string;
    priceMinor: string;
    stockQuantity?: number;
  }) => request<Product>('/products', { method: 'POST', body: JSON.stringify(input) }),

  createUser: (input: { email: string; fullName: string; roles?: string[] }) =>
    request<User>('/users', { method: 'POST', body: JSON.stringify(input) }),

  getUser: (id: string) => request<User>(`/users/${id}`),

  createOrder: (input: {
    buyerId: string;
    sellerId: string;
    items: { productId: string; quantity: number; variant?: Record<string, unknown> }[];
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
