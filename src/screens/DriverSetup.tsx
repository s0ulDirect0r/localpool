import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, H2, Muted, Row, colors } from '../components/ui';
import { useApp } from '../state/AppContext';
import { SAVED_PLACES, distanceLabel } from '../state/mock';
import type { Location } from '../types';

export function DriverSetupScreen() {
  const { navigate, startDriverTrip } = useApp();
  const [pickup, setPickup] = useState<Location | null>(SAVED_PLACES[0]);
  const [dropoff, setDropoff] = useState<Location | null>(SAVED_PLACES[1]);
  const [seats, setSeats] = useState(3);

  const ready = pickup && dropoff && pickup.label !== dropoff.label;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={styles.container}>
      <Pressable onPress={() => navigate('home')}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <H1>Plan your route</H1>
      <Muted>Tell us where you're heading and how many seats you can share.</Muted>

      <Card>
        <H2>Starting from</H2>
        <Picker selected={pickup} onSelect={setPickup} excludeLabel={dropoff?.label} />
      </Card>

      <Card>
        <H2>Heading to</H2>
        <Picker selected={dropoff} onSelect={setDropoff} excludeLabel={pickup?.label} />
      </Card>

      <Card>
        <Row>
          <H2>Available seats</H2>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4].map((n) => (
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
          <Muted>Trip distance</Muted>
          <Text style={styles.dist}>{distanceLabel(pickup!, dropoff!)}</Text>
        </Card>
      )}

      <Button
        title="Go online"
        disabled={!ready}
        onPress={() => startDriverTrip(pickup!, dropoff!, seats)}
      />
    </ScrollView>
  );
}

function Picker({
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
  dist: { fontSize: 22, fontWeight: '700', color: colors.text },
});
