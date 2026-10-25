import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTokens } from '../theme/tokens';
import { api } from '../api/client';
import { useDevIdentity } from '../lib/useDevIdentity';

export default function SellerNewProductScreen() {
  const t = useTokens();
  const { user: seller, loading, createIdentity } = useDevIdentity('seller');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateProduct() {
    setError(null);
    setSubmitting(true);
    try {
      let sellerId = seller?.id;
      if (!sellerId) {
        const created = await createIdentity({ email, fullName: name });
        sellerId = created.id;
      }
      const priceMinor = Math.round(Number(price) * 100).toString();
      const product = await api.createProduct({
        sellerId,
        title,
        description,
        priceMinor,
        stockQuantity: Number(stock),
      });
      setCreatedSlug(product.slug);
      setTitle('');
      setDescription('');
      setPrice('');
      setStock('1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the product.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: t.ink }]}>List a product</Text>
      <Text style={[styles.body, { color: t.inkSoft }]}>
        Create a product and get a unique code to share on WhatsApp, Instagram, Facebook or TikTok.
      </Text>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        {!seller && !loading && (
          <>
            <Field label="Your name" value={name} onChangeText={setName} tokens={t} />
            <Field label="Your email" value={email} onChangeText={setEmail} tokens={t} autoCapitalize="none" />
          </>
        )}

        <Field label="Product title" value={title} onChangeText={setTitle} tokens={t} placeholder="Ankara fabric, 6 yards" />
        <Field label="Description" value={description} onChangeText={setDescription} tokens={t} multiline />
        <Field label="Price (NGN)" value={price} onChangeText={setPrice} tokens={t} keyboardType="numeric" />
        <Field label="Stock" value={stock} onChangeText={setStock} tokens={t} keyboardType="numeric" />

        {error && <Text style={{ color: t.alert, marginBottom: 10 }}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: t.primary, opacity: submitting ? 0.6 : 1 }]}
          disabled={submitting || !title || !price || (!seller && (!name || !email))}
          onPress={handleCreateProduct}
        >
          <Text style={styles.buttonText}>{submitting ? 'Creating…' : 'Create product & get code'}</Text>
        </TouchableOpacity>

        {createdSlug && (
          <Text style={{ color: t.ink, marginTop: 14 }}>
            Product code: <Text style={[styles.mono, { color: t.primary }]}>{createdSlug}</Text>
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  tokens: t,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  tokens: ReturnType<typeof useTokens>;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        style={[styles.input, { borderColor: t.lineStrong, color: t.ink }, rest.multiline && { minHeight: 70, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={t.muted}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 72, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 6 },
  body: { fontSize: 15, lineHeight: 21, marginBottom: 18 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18 },
  label: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  button: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  mono: { fontFamily: 'Courier', fontWeight: '600' },
});
