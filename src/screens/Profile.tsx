import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Card, H1, H2, Muted, colors } from '../components/ui';
import { useApp } from '../state/AppContext';

export function ProfileScreen() {
  const { user, updateProfile, signOut, navigate } = useApp();
  const [vehicle, setVehicle] = useState(user?.vehicle ?? '');
  const [seats, setSeats] = useState(String(user?.seats ?? 3));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const onSave = async () => {
    setBusy(true);
    try {
      await updateProfile({
        vehicle: vehicle.trim() || null,
        seats: Math.max(1, Math.min(7, Number(seats) || 3)),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
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
        <Pressable onPress={() => navigate('home')}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <H1>Profile</H1>

        <Card>
          <H2>{user.name}</H2>
          <Muted>{user.email}</Muted>
          <Muted>{user.phone}</Muted>
        </Card>

        <Card>
          <H2>Vehicle (for driving)</H2>
          <Text style={styles.label}>Vehicle description</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Toyota Prius (Silver)"
            placeholderTextColor="#999"
            value={vehicle}
            onChangeText={setVehicle}
          />
          <Text style={styles.label}>Seats you can offer</Text>
          <TextInput
            style={styles.input}
            placeholder="3"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            value={seats}
            onChangeText={setSeats}
          />
          <View style={{ height: 12 }} />
          <Button
            title={saved ? 'Saved ✓' : 'Save changes'}
            loading={busy}
            onPress={onSave}
          />
        </Card>

        <Button title="Sign out" variant="danger" onPress={signOut} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 14, paddingBottom: 64 },
  back: { fontSize: 16, color: colors.subtle },
  label: { fontSize: 13, color: colors.subtle, fontWeight: '600', marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
    marginTop: 6,
  },
});
