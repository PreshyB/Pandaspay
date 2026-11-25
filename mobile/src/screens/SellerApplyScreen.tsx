import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Button, Field } from '../components/ui';
import type { RootStackParamList } from '../navigation';
import { useAccount } from '../lib/useDevIdentity';
import { useTokens } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerApply'>;

/** Sellers are approved by PayTight before they can list products. */
export default function SellerApplyScreen({ navigation }: Props) {
  const t = useTokens();
  const { user, sellerStatus, refresh } = useAccount();
  const [businessName, setBusinessName] = useState('');
  const [socialLink, setSocialLink] = useState('');
  const [storeState, setStoreState] = useState('');
  const [storeCity, setStoreCity] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.applyToSell({
        businessName: businessName.trim(),
        socialLink: socialLink.trim() || undefined,
        note: note.trim() || undefined,
        storeState: storeState.trim(),
        storeCity: storeCity.trim() || undefined,
      });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your application.');
    } finally {
      setBusy(false);
    }
  }

  const status = (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Text style={{ color: t.ink, lineHeight: 22 }}>
        {sellerStatus === 'PENDING'
          ? 'Your application is with the PayTight team. Once it is approved you can list products here.'
          : sellerStatus === 'APPROVED'
            ? 'You are approved. You can list products now.'
            : `Your application was not approved.${user?.sellerReviewNote ? ` Reason: ${user.sellerReviewNote}` : ''}`}
      </Text>
      <View style={{ marginTop: 14 }}>
        <Button title={sellerStatus === 'APPROVED' ? 'Go to dashboard' : 'Back'} onPress={() => navigation.navigate(sellerStatus === 'APPROVED' ? 'SellerDashboard' : 'Home')} />
      </View>
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: t.ink }]}>Start selling</Text>
      {sellerStatus === 'PENDING' || sellerStatus === 'APPROVED' || sellerStatus === 'REJECTED' ? (
        status
      ) : (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text style={{ color: t.inkSoft, marginBottom: 14, lineHeight: 21 }}>Tell us about your business. We review every seller before they can list.</Text>
          <Field label="Business or shop name" value={businessName} onChangeText={setBusinessName} />
          <Field label="Instagram / WhatsApp / TikTok link (optional)" value={socialLink} onChangeText={setSocialLink} autoCapitalize="none" />
          <Field label="State you ship from" value={storeState} onChangeText={setStoreState} placeholder="Lagos" />
          <Field label="City (optional)" value={storeCity} onChangeText={setStoreCity} />
          <Field label="Anything else we should know (optional)" value={note} onChangeText={setNote} multiline />
          {error && <Text style={{ color: t.alert, marginBottom: 10 }}>{error}</Text>}
          <Button title="Send application" busy={busy} disabled={businessName.trim().length < 2 || storeState.trim().length < 2} onPress={submit} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 72, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18 },
});
