import { StyleSheet, Text, View } from 'react-native';
import type { OrderStatus, PaymentProtectionStatus } from '../api/types';
import { useTokens } from '../theme/tokens';

/**
 * Renders the order-status and payment-protection badges as two
 * independent pieces — per the state-machine spec §1: never merge the
 * two tracks into one piece of copy. Mirrors web/src/components/StatusBadges.tsx.
 */

const ORDER_LABEL: Record<OrderStatus, string> = {
  CREATED: 'Order placed',
  CANCELLED: 'Cancelled',
  PREPARING: 'Seller preparing',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  DELIVERY_FAILED: 'Delivery attempt failed',
  RETURNED: 'Returned to seller',
};

const PAYMENT_LABEL: Record<PaymentProtectionStatus, string> = {
  AWAITING_PAYMENT: 'Confirming payment…',
  PAYMENT_DECLINED: 'Payment declined',
  PROTECTED: 'Payment protected',
  DISPUTED: 'Payment on hold — dispute open',
  RELEASABLE: 'Pending settlement',
  RELEASED: 'Settled to seller',
  REFUND_APPROVED: 'Refund in progress',
  REFUNDED: 'Refunded',
  PARTIALLY_RESOLVED: 'Partially refunded',
};

type Tone = 'neutral' | 'protected' | 'amber' | 'alert';

const PAYMENT_TONE: Record<PaymentProtectionStatus, Tone> = {
  AWAITING_PAYMENT: 'neutral',
  PAYMENT_DECLINED: 'alert',
  PROTECTED: 'protected',
  DISPUTED: 'alert',
  RELEASABLE: 'amber',
  RELEASED: 'protected',
  REFUND_APPROVED: 'amber',
  REFUNDED: 'neutral',
  PARTIALLY_RESOLVED: 'amber',
};

const ORDER_TONE: Record<OrderStatus, Tone> = {
  CREATED: 'neutral',
  CANCELLED: 'neutral',
  PREPARING: 'neutral',
  SHIPPED: 'amber',
  IN_TRANSIT: 'amber',
  DELIVERED: 'protected',
  DELIVERY_FAILED: 'alert',
  RETURNED: 'neutral',
};

export function StatusBadges({
  orderStatus,
  paymentStatus,
}: {
  orderStatus: OrderStatus;
  paymentStatus: PaymentProtectionStatus;
}) {
  const t = useTokens();
  const toneColor = (tone: Tone) =>
    ({
      neutral: { bg: t.line, fg: t.inkSoft },
      protected: { bg: t.protectedSoft, fg: t.protected },
      amber: { bg: t.amberSoft, fg: t.amber },
      alert: { bg: t.alertSoft, fg: t.alert },
    })[tone];

  const orderColors = toneColor(ORDER_TONE[orderStatus]);
  const paymentColors = toneColor(PAYMENT_TONE[paymentStatus]);

  return (
    <View style={styles.row}>
      <View style={styles.track}>
        <Text style={[styles.label, { color: t.muted }]}>ORDER</Text>
        <View style={[styles.badge, { backgroundColor: orderColors.bg }]}>
          <Text style={[styles.badgeText, { color: orderColors.fg }]}>{ORDER_LABEL[orderStatus]}</Text>
        </View>
      </View>
      <View style={styles.track}>
        <Text style={[styles.label, { color: t.muted }]}>PAYMENT</Text>
        <View style={[styles.badge, { backgroundColor: paymentColors.bg }]}>
          <Text style={[styles.badgeText, { color: paymentColors.fg }]}>{PAYMENT_LABEL[paymentStatus]}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  track: { gap: 4 },
  label: { fontSize: 11, letterSpacing: 0.4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 13, fontWeight: '500' },
});
