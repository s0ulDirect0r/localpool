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
  const { signUp, navigate, error, clearError } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    email.includes('@') &&
    phone.trim().length >= 7 &&
    password.length >= 6;

  const onSubmit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await signUp(name, email, phone, password);
    } catch {
      // error surfaced via context
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <H1>Create account</H1>
          <Muted>Join the carpool — takes a minute.</Muted>
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
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Button title="Continue" onPress={onSubmit} loading={busy} disabled={!canSubmit} />
          <Button
            title="Already have an account? Sign in"
            variant="ghost"
            onPress={() => {
              clearError();
              navigate('signin');
            }}
          />
          <Button
            title="Back"
            variant="ghost"
            onPress={() => {
              clearError();
              navigate('welcome');
            }}
          />
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
      <TextInput style={styles.input} placeholderTextColor="#999" {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 64,
    gap: 24,
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
  errorBox: {
    backgroundColor: '#fde8e8',
    borderColor: '#f5a3a3',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: '#7a1212', fontWeight: '600' },
});
