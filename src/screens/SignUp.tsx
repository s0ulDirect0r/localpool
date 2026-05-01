import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, H1, Muted, colors } from '../components/ui';
import { useApp } from '../state/AppContext';

export function SignUpScreen() {
  const { signIn, navigate } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim().length > 0 && email.includes('@') && phone.trim().length >= 7;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    await signIn(name, email, phone);
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <H1>Create account</H1>
          <Muted>No password needed for this demo.</Muted>
        </View>

        <View style={{ gap: 12 }}>
          <Field label="Full name" value={name} onChangeText={setName} placeholder="Jane Doe" />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="jane@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="555-0143"
            keyboardType="phone-pad"
          />
        </View>

        <View style={{ gap: 10 }}>
          <Button title="Continue" onPress={onSubmit} loading={busy} disabled={!canSubmit} />
          <Button title="Back" variant="ghost" onPress={() => navigate('welcome')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor="#999"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 64,
    gap: 28,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  label: { fontSize: 13, color: colors.subtle, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
  },
});
