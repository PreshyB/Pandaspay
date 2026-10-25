import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useTokens } from '../theme/tokens';
import { api } from '../api/client';
import type { OrderWithPayment } from '../api/types';
import { StatusBadges } from '../components/StatusBadges';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerDashboard'>;

export default function SellerDashboardScreen({ navigation }: Props) {
  const t = useTokens();
  const { user: seller, loading: identityLoading, createIdentity } = useDevIdentity('seller');
  const [orders, setOrders] = useState<OrderWithPayment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [waybillDrafts, setWaybillDrafts] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const refresh = useCallback(() => {
    if (!seller) return;
    api.listOrdersForSeller(seller.id).then(setOrders).catch(() => setError('Could not load orders.'));
  }, [seller]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run(orderId: string, action: () => Promise<unknown>) {
    setBusyId(orderId);
    setError(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That action failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (identityLoading) return null;

  if (!seller) {
    return (
      <View style={[styles.container, { backgroundColor: t.paper }]}>
        <Text style={[styles.title, { color: t.ink }]}>Seller dashboard</Text>
        <Text style={[styles.body, { color: t.inkSoft }]}>
          Sign in with the dev identity you used when listing a product (or create one here).
        </Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          <TextInput
            style={[styles.input, { borderColor: t.lineStrong, color: t.ink, marginBottom: 10 }]}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={t.muted}
          />
          <TextInput
            style={[styles.input, { borderColor: t.lineStrong, color: t.ink, marginBottom: 14 }]}
            value={email}
            onChangeText={setEmail}
            placeholder="Your email"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: t.primary }]}
            disabled={!name || !email}
            onPress={() => createIdentity({ email, fullName: name })}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.paper }]}>
      <Text style={[styles.title, { color: t.ink }]}>Orders</Text>
      <Text style={{ color: t.muted, marginBottom: 16 }}>{seller.fullName}</Text>
      {error && <Text style={{ color: t.alert, marginBottom: 10 }}>{error}</Text>}

      <TouchableOpacity style={{ marginBottom: 16 }} onPress={() => navigation.navigate('SellerNewProduct')}>
        <Text style={{ color: t.primary, fontWeight: '600' }}>+ List a new product</Text>
      </TouchableOpacity>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        ListEmptyComponent={<Text style={{ color: t.muted }}>No orders yet.</Text>}
        renderItem={({ item: order }) => {
          const canAccept = order.status === 'CREATED' && order.payment.protectionStatus !== 'AWAITING_PAYMENT';
          const canShip = order.status === 'PREPARING';
          const busy = busyId === order.id;

          return (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line, marginBottom: 12 }]}>
              <Text style={[styles.mono, { color: t.primary }]}>{order.id.slice(0, 8)}…</Text>
              <View style={{ marginTop: 8, marginBottom: 8 }}>
                <StatusBadges orderStatus={order.status} paymentStatus={order.payment.protectionStatus} />
              </View>
              <Text style={{ color: t.muted, marginBottom: 12 }}>{formatMoney(order.totalMinor, order.currency)}</Text>

              <View style={styles.actionsRow}>
                {canAccept && (
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: t.primarySoft }]}
                    disabled={busy}
                    onPress={() => run(order.id, () => api.acceptOrder(order.id))}
                  >
                    <Text style={{ color: t.primary, fontWeight: '600' }}>Accept</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'CREATED' && (
                  <TouchableOpacity
                    style={[styles.smallButton, styles.outline, { borderColor: t.lineStrong }]}
                    disabled={busy}
                    onPress={() => run(order.id, () => api.declineOrder(order.id, seller.id))}
                  >
                    <Text style={{ color: t.ink, fontWeight: '600' }}>Decline</Text>
                  </TouchableOpacity>
                )}
              </View>

              {canShip && (
                <View style={{ marginTop: 10 }}>
                  <TextInput
                    style={[styles.input, { borderColor: t.lineStrong, color: t.ink, marginBottom: 8 }]}
                    placeholder="Waybill ref"
                    placeholderTextColor={t.muted}
                    value={waybillDrafts[order.id] ?? ''}
                    onChangeText={(v) => setWaybillDrafts((d) => ({ ...d, [order.id]: v }))}
                  />
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: t.primary }]}
                    disabled={busy || !waybillDrafts[order.id]}
                    onPress={() => run(order.id, () => api.shipOrder(order.id, waybillDrafts[order.id]))}
                  >
                    <Text style={{ color: 'white', fontWeight: '600' }}>Mark shipped</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 72 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 4 },
  body: { fontSize: 15, lineHeight: 21, marginBottom: 18 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  mono: { fontFamily: 'Courier', fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  button: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  smallButton: { borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14 },
  outline: { borderWidth: 1, backgroundColor: 'transparent' },
});
