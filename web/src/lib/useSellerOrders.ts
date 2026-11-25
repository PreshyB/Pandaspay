import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Order, Payment } from '../api/types';

export type SellerOrder = Order & { payment: Payment };

export const needsAccept = (o: SellerOrder) => o.status === 'CREATED' && o.payment.protectionStatus !== 'AWAITING_PAYMENT';
export const needsShipping = (o: SellerOrder) => o.status === 'PREPARING';
export const isDisputed = (o: SellerOrder) => o.payment.protectionStatus === 'DISPUTED';
export const isOnTheWay = (o: SellerOrder) => o.status === 'SHIPPED' || o.status === 'IN_TRANSIT';
export const isDone = (o: SellerOrder) => ['DELIVERED', 'CANCELLED', 'RETURNED'].includes(o.status) && !isDisputed(o);

export function useSellerOrders(sellerId: string | undefined) {
  const [orders, setOrders] = useState<SellerOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!sellerId) return;
    api
      .listOrdersForSeller(sellerId)
      .then((o) => {
        setOrders([...o].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setError(null);
      })
      .catch(() => setError('Could not load orders.'));
  }, [sellerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { orders, error, refresh };
}
