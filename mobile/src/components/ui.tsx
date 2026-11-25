import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';
import { useTokens } from '../theme/tokens';

export function Field({ label, ...rest }: { label: string } & TextInputProps) {
  const t = useTokens();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        {...rest}
        style={[styles.input, { borderColor: t.lineStrong, color: t.ink }, rest.multiline && { minHeight: 70, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function Button({ title, onPress, disabled, busy }: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  const t = useTokens();
  const off = disabled || busy;
  return (
    <TouchableOpacity style={[styles.button, { backgroundColor: t.primary, opacity: off ? 0.5 : 1 }]} disabled={off} onPress={onPress}>
      {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  button: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', minHeight: 46, justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 15 },
});
