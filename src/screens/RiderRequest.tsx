import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, H2, Muted, Pill, Row, colors } from '../components/ui';
import { useApp } from '../state/AppContext';
import { SAVED_PLACES, distanceLabel, estimateFare } from '../state/mock';
import type { Location } from '../types';

export function RiderRequestScreen() {
  const { navigate, riderRequest, error } = useApp();
  const [pickup, setPickup] = useState<Location | null>(SAVED_PLACES[0]);
  const [dropoff, setDropoff] = useState<Location | null>(null);
  const [seats, setSeats] = useState(1);
  const [busy, setBusy] = useState(false);

  const ready = pickup && dropoff && pickup.label !== dropoff.label;
  const fare = ready ? estimateFare(pickup!, dropoff!, true) : 0;

  const onSubmit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await riderRequest(pickup!, dropoff!, seats);
    } catch {
      // surfaced
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={styles.container}
    >
      <Pressable onPress={() => navigate('home')}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <H1>Where to?</H1>

      <Card>
        <H2>Pickup</H2>
        <PlacePicker selected={pickup} onSelect={setPickup} excludeLabel={dropoff?.label} />
      </Card>

      <Card>
        <H2>Drop-off</H2>
        <PlacePicker selected={dropoff} onSelect={setDropoff} excludeLabel={pickup?.label} />
      </Card>

      <Card>
        <Row>
          <H2>Seats needed</H2>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3].map((n) => (
              <Pressable
                key={n}
                onPress={() => setSeats(n)}
                style={[styles.chip, seats === n && styles.chipActive]}
              >
                <Text style={[styles.chipText, seats === n && styles.chipTextActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </Row>
      </Card>

      {ready && (
        <Card style={{ backgroundColor: colors.surface }}>
          <Row>
            <View>
              <Muted>Estimated carpool fare</Muted>
              <Text style={styles.fare}>${fare.toFixed(2)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Muted>{distanceLabel(pickup!, dropoff!)}</Muted>
              <Pill label="Up to 45% off solo" tone="good" />
            </View>
          </Row>
        </Card>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button
        title="Find carpool matches"
        disabled={!ready}
        loading={busy}
        onPress={onSubmit}
      />
    </ScrollView>
  );
}

function PlacePicker({
  selected,
  onSelect,
  excludeLabel,
}: {
  selected: Location | null;
  onSelect: (l: Location) => void;
  excludeLabel?: string;
}) {
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      {SAVED_PLACES.map((p) => {
        const disabled = p.label === excludeLabel;
        const active = selected?.label === p.label;
        return (
          <Pressable
            key={p.label}
            disabled={disabled}
            onPress={() => onSelect(p)}
            style={[
              styles.place,
              active && styles.placeActive,
              disabled && { opacity: 0.4 },
            ]}
          >
            <Text style={[styles.placeText, active && { color: '#fff' }]}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 16, paddingBottom: 64 },
  back: { fontSize: 16, color: colors.subtle },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: '600', color: colors.text },
  chipTextActive: { color: '#fff' },
  place: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  placeText: { fontSize: 15, fontWeight: '500', color: colors.text },
  fare: { fontSize: 24, fontWeight: '700', color: colors.text },
  errorBox: {
    backgroundColor: '#fde8e8',
    borderColor: '#f5a3a3',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: '#7a1212', fontWeight: '600' },
});
