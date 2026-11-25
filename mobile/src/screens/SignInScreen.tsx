import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Button, Field } from '../components/ui';
import type { RootStackParamList } from '../navigation';
import { setToken } from '../lib/session';
import { useTokens } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

/** Email, then the 6-digit code we send. New people create their account first. */
export default function SignInScreen({ navigation }: Props) {
  const t = useTokens();
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const address = email.trim().toLowerCase();
      if (mode === 'create') {
        await api.createUser({ email: address, fullName: fullName.trim() });
      }
      const r = await api.requestCode(address);
      setDevCode(r.devCode ?? null);
      setEmail(address);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.verifyCode(email, code.trim());
      await setToken(token);
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code is not right.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: t.paper }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: t.ink }]}>{step === 'code' ? 'Check your email' : mode === 'create' ? 'Create your account' : 'Sign in'}</Text>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
        {step === 'email' ? (
          <>
            {mode === 'create' && <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" />}
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} placeholder="you@example.com" />
            {error && <Text style={{ color: t.alert, marginBottom: 10 }}>{error}</Text>}
            <Button title="Send me a code" busy={busy} disabled={!email.includes('@') || (mode === 'create' && fullName.trim().length < 2)} onPress={sendCode} />
            <TouchableOpacity
              style={{ marginTop: 16 }}
              onPress={() => {
                setMode(mode === 'signin' ? 'create' : 'signin');
                setError(null);
              }}
            >
              <Text style={{ color: t.primary }}>{mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={{ color: t.inkSoft, marginBottom: 12, lineHeight: 21 }}>We sent a 6-digit code to {email}. It works for 10 minutes.</Text>
            {devCode && (
              <TouchableOpacity onPress={() => setCode(devCode)} style={[styles.dev, { backgroundColor: t.amberSoft }]}>
                <Text style={{ color: t.ink }}>
                  Test version: email isn't connected yet, so your code is {devCode}. Tap to fill it in.
                </Text>
              </TouchableOpacity>
            )}
            <Field label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} />
            {error && <Text style={{ color: t.alert, marginBottom: 10 }}>{error}</Text>}
            <Button title="Sign in" busy={busy} disabled={code.length !== 6} onPress={verify} />
            <TouchableOpacity style={{ marginTop: 16 }} onPress={() => { setStep('email'); setCode(''); setError(null); }}>
              <Text style={{ color: t.primary }}>Use a different email</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 72, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18 },
  dev: { borderRadius: 8, padding: 10, marginBottom: 12 },
});
