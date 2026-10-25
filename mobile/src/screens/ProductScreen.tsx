import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useTokens } from '../theme/tokens';
import { api } from '../api/client';
import type { Product } from '../api/types';
import { formatMoney } from '../lib/money';
import { useDevIdentity } from '../lib/useDevIdentity';

type Props = NativeStackScreenProps<RootStackParamList, 'Product'>;

export default function ProductScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const t = useTokens();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const { user: buyer, loading: identityLoading, createIdentity } = useDevIdentity('buyer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    api
      .getProductBySlug(slug)
      .then(setProduct)
      .catch(() => setError('Product not found — check the code and try again.'));
  }, [slug]);

  async function handleBuyNow() {
    if (!product) return;
    setError(null);
    setPlacing(true);
    try {
      let buyerId = buyer?.id;
      if (!buyerId) {
        const created = await createIdentity({ email, fullName: name });
        buyerId = created.id;
      }
      const { order } = await api.createOrder({
        buyerId,
        sellerId: product.sellerId,
        items: [{ productId: product.id, quantity: Math.max(1, Number(quantity) || 1) }],
      });
      navigation.navigate('OrderStatus', { orderId: order.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place the order. Try again.');
    } finally {
      setPlacing(false);
    }
  }

  if (error && !product) {
    return (
      <View style={[styles.container, { backgroundColor: t.paper }]}>
        <Text style={{ color: t.alert }}>{error}</Text>
      </View>
    );
  }
  if (!product) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: t.paper }]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.paper }]}>
      <Text style={[styles.title, { color: t.ink }]}>{product.title}</Text>
      <Text style={[styles.body, { color: t.inkSoft }]}>{product.description || 'No description provided.'}</Text>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: t.ink }]}>{formatMoney(product.priceMinor, product.currency)}</Text>
          <Text style={{ color: t.muted }}>{product.stockQuantity} in stock</Text>
        </View>

        <Text style={[styles.label, { color: t.muted }]}>Quantity</Text>
        <TextInput
          style={[styles.input, { borderColor: t.lineStrong, color: t.ink }]}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
        />

        {!buyer && !identityLoading && (
          <>
            <Text style={[styles.label, { color: t.muted }]}>Your name</Text>
            <TextInput
              style={[styles.input, { borderColor: t.lineStrong, color: t.ink }]}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={t.muted}
            />
            <Text style={[styles.label, { color: t.muted }]}>Your email</Text>
            <TextInput
              style={[styles.input, { borderColor: t.lineStrong, color: t.ink }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={t.muted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </>
        )}

        {error && <Text style={{ color: t.alert, marginBottom: 10 }}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: t.primary, opacity: placing ? 0.6 : 1 }]}
          disabled={placing || (!buyer && (!name || !email))}
          onPress={handleBuyNow}
        >
          <Text style={styles.buttonText}>{placing ? 'Placing order…' : 'Buy now — payment protected'}</Text>
        </TouchableOpacity>
        <Text style={[styles.muted, { color: t.muted }]}>
          Your payment is protected until delivery is confirmed.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 72 },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 6 },
  body: { fontSize: 15, lineHeight: 21, marginBottom: 18 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 },
  price: { fontSize: 20, fontWeight: '600' },
  label: { fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 12 },
  button: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  muted: { fontSize: 13, marginTop: 10 },
});
