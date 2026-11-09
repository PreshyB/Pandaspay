import type { CreateOrderResponse, Order, Payment, Product } from './types';

// Empty in dev (vite.config.ts proxies /api to the backend). Set
// VITE_API_BASE_URL at build time to point a production build at a
// deployed backend origin, e.g. https://api.pandaspay.com.
const BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`;

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
    brand?: string;
    options?: { name: string; values: string[] }[];
  }) => request<Product>('/products', { method: 'POST', body: JSON.stringify(input) }),

  createOrder: (input: {
    buyerId: string;
    sellerId: string;
    items: { productId: string; quantity: number; variant?: Record<string, unknown> }[];
    deliveryAddress?: Record<string, unknown>;
  }) => request<CreateOrderResponse>('/orders', { method: 'POST', body: JSON.stringify(input) }),

  getOrder: (id: string) => request<Order & { payment: Payment }>(`/orders/${id}`),

  listOrdersForSeller: (sellerId: string) =>
    request<(Order & { payment: Payment })[]>(`/orders?sellerId=${encodeURIComponent(sellerId)}`),

  listOrdersForBuyer: (buyerId: string) =>
    request<(Order & { payment: Payment })[]>(`/orders?buyerId=${encodeURIComponent(buyerId)}`),

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
