import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useTokens } from '../theme/tokens';
import { api } from '../api/client';
import type { OrderWithPayment } from '../api/types';
import { StatusBadges } from '../components/StatusBadges';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderStatus'>;

export default function OrderStatusScreen({ route }: Props) {
  const { orderId } = route.params;
  const t = useTokens();
  const [order, setOrder] = useState<OrderWithPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const { user: buyer } = useDevIdentity('buyer');

  const refresh = useCallback(() => {
    api.getOrder(orderId).then(setOrder).catch(() => setError('Could not load this order.'));
  }, [orderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That action failed.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) {
    return (
      <View style={[styles.container, { backgroundColor: t.paper }]}>
        <Text style={{ color: t.alert }}>{error}</Text>
      </View>
    );
  }
  if (!order) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: t.paper }]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  const { payment } = order;
  const canSimulatePayment = payment.protectionStatus === 'AWAITING_PAYMENT' && payment.providerTransactionRef;
  const canConfirmDelivered = order.status === 'SHIPPED' || order.status === 'IN_TRANSIT';
  const canDispute = payment.protectionStatus === 'PROTECTED' || payment.protectionStatus === 'RELEASABLE';

  return (
    <View style={[styles.container, { backgroundColor: t.paper }]}>
      <Text style={[styles.title, { color: t.ink }]}>Order</Text>
      <Text style={[styles.mono, { color: t.muted }]}>{order.id}</Text>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <StatusBadges orderStatus={order.status} paymentStatus={payment.protectionStatus} />

        <Text style={[styles.price, { color: t.ink }]}>{formatMoney(order.totalMinor, order.currency)}</Text>
        <Text style={{ color: t.muted, marginBottom: 16 }}>
          {order.items.length} item{order.items.length === 1 ? '' : 's'}
        </Text>

        {error && <Text style={{ color: t.alert, marginBottom: 10 }}>{error}</Text>}

        <View style={styles.actions}>
          {canSimulatePayment && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: t.primarySoft }]}
              disabled={busy}
              onPress={() => run(() => api.simulatePaymentConfirmed(payment.providerTransactionRef!))}
            >
              <Text style={{ color: t.primary, fontWeight: '600' }}>Simulate PalmPay confirmation</Text>
            </TouchableOpacity>
          )}

          {canConfirmDelivered && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: t.primary }]}
              disabled={busy}
              onPress={() => run(() => api.confirmDelivered(order.id, 'BUYER'))}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>I've received this order</Text>
            </TouchableOpacity>
          )}

          {order.status === 'CREATED' && buyer && (
            <TouchableOpacity
              style={[styles.button, styles.outline, { borderColor: t.lineStrong }]}
              disabled={busy}
              onPress={() => run(() => api.cancelOrder(order.id, buyer.id))}
            >
              <Text style={{ color: t.ink, fontWeight: '600' }}>Cancel order</Text>
            </TouchableOpacity>
          )}

          {canDispute && !showDisputeForm && (
            <TouchableOpacity style={[styles.button, styles.outline, { borderColor: t.lineStrong }]} onPress={() => setShowDisputeForm(true)}>
              <Text style={{ color: t.ink, fontWeight: '600' }}>Report a problem</Text>
            </TouchableOpacity>
          )}
        </View>

        {showDisputeForm && (
          <View style={styles.disputeBox}>
            <TextInput
              style={[styles.input, { borderColor: t.lineStrong, color: t.ink }]}
              value={disputeReason}
              onChangeText={setDisputeReason}
              placeholder="What went wrong?"
              placeholderTextColor={t.muted}
              multiline
            />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: t.alertSoft }]}
              disabled={busy || !disputeReason.trim() || !buyer}
              onPress={() =>
                run(async () => {
                  await api.openDispute(payment.id, buyer!.id, disputeReason.trim());
                  setShowDisputeForm(false);
                  setDisputeReason('');
                })
              }
            >
              <Text style={{ color: t.alert, fontWeight: '600' }}>Open dispute — freezes the payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {payment.protectionStatus === 'PROTECTED' && (
          <Text style={{ color: t.muted, fontSize: 13, marginTop: 16, lineHeight: 19 }}>
            Your payment is protected according to the transaction terms. It stays protected until delivery is
            confirmed, then a short protection window before the seller is paid.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 72 },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 4 },
  mono: { fontSize: 12, marginBottom: 18, fontFamily: 'Courier' },
  card: { borderWidth: 1, borderRadius: 16, padding: 18 },
  price: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  actions: { gap: 10 },
  button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  outline: { borderWidth: 1, backgroundColor: 'transparent' },
  disputeBox: { marginTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)', paddingTop: 16, gap: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 70, textAlignVertical: 'top' },
});
