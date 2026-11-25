import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useTokens } from '../theme/tokens';
import { useAccount } from '../lib/useDevIdentity';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const t = useTokens();
  const [slug, setSlug] = useState('');
  const { user, loading, isSeller, signOut } = useAccount();

  return (
    <View style={[styles.container, { backgroundColor: t.paper }]}>
      <View style={styles.topRow}>
        <Text style={[styles.brand, { color: t.primary }]}>PayTight</Text>
        {!loading &&
          (user ? (
            <TouchableOpacity onPress={() => void signOut()}>
              <Text style={{ color: t.muted }}>{user.fullName.split(' ')[0]} · Sign out</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={{ color: t.primary, fontWeight: '600' }}>Sign in</Text>
            </TouchableOpacity>
          ))}
      </View>
      <Text style={[styles.title, { color: t.ink }]}>Buy with payment protection</Text>
      <Text style={[styles.body, { color: t.inkSoft }]}>
        Paste the product code a seller shared with you on WhatsApp, Instagram or TikTok.
      </Text>

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text style={[styles.label, { color: t.muted }]}>Product code</Text>
        <TextInput
          style={[styles.input, { borderColor: t.lineStrong, color: t.ink }]}
          value={slug}
          onChangeText={setSlug}
          placeholder="e.g. a1b2c3d4"
          placeholderTextColor={t.muted}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.button, { backgroundColor: t.primary }]}
          onPress={() => slug.trim() && navigation.navigate('Product', { slug: slug.trim() })}
        >
          <Text style={styles.buttonText}>View product</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => (!user ? navigation.navigate('SignIn') : isSeller ? navigation.navigate('SellerDashboard') : navigation.navigate('SellerApply'))}
      >
        <Text style={{ color: t.primary }}>{isSeller ? 'Selling? Go to your seller dashboard →' : 'Want to sell? Start selling →'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 72 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  brand: { fontSize: 20, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '600', marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18 },
  label: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 14 },
  button: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  linkRow: { marginTop: 24 },
});
