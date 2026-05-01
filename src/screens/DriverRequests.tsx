import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, H2, Muted, Pill, Row, colors } from '../components/ui';
import { useApp } from '../state/AppContext';
import { generatePassengerRequests } from '../state/mock';
import type { Passenger } from '../types';

export function DriverRequestsScreen() {
  const { activeRide, acceptPassenger, navigate, cancelRide } = useApp();
  const [pool, setPool] = useState<Passenger[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, true>>({});

  useEffect(() => {
    if (!activeRide) return;
    setPool(generatePassengerRequests(activeRide.pickup, activeRide.dropoff));
  }, [activeRide?.id]);

  const acceptedIds = useMemo(
    () => new Set((activeRide?.passengers ?? []).map((p) => p.id)),
    [activeRide?.passengers],
  );

  if (!activeRide) return null;

  const seatsTaken = (activeRide.passengers ?? []).reduce((s, p) => s + p.seats, 0);
  const seatsLeft = activeRide.seats - seatsTaken;
  const visible = pool.filter((p) => !acceptedIds.has(p.id) && !dismissed[p.id]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={styles.container}>
      <H1>Looking for riders</H1>
      <Muted>
        {activeRide.pickup.label} → {activeRide.dropoff.label} · {seatsLeft} seat
        {seatsLeft === 1 ? '' : 's'} open
      </Muted>

      <Card>
        <Row>
          <H2>Accepted</H2>
          <Pill label={`$${activeRide.fare.toFixed(2)} earned`} tone="good" />
        </Row>
        {(activeRide.passengers ?? []).length === 0 ? (
          <Muted>No passengers yet — accept requests below.</Muted>
        ) : (
          (activeRide.passengers ?? []).map((p) => (
            <View key={p.id} style={styles.acceptedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Muted>
                  {p.pickup.label} → {p.dropoff.label} · {p.seats} seat
                  {p.seats === 1 ? '' : 's'}
                </Muted>
              </View>
              <Text style={styles.fare}>+${p.fare.toFixed(2)}</Text>
            </View>
          ))
        )}
      </Card>

      <H2>Nearby requests</H2>
      {visible.length === 0 ? (
        <Card>
          <Muted>No more requests right now.</Muted>
        </Card>
      ) : (
        visible.map((p) => {
          const fits = p.seats <= seatsLeft;
          return (
            <Card key={p.id}>
              <Row>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Muted>
                    {p.pickup.label} → {p.dropoff.label}
                  </Muted>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <Pill label={`${p.seats} seat${p.seats === 1 ? '' : 's'}`} />
                    {!fits && <Pill label="Not enough seats" tone="warn" />}
                  </View>
                </View>
                <Text style={styles.fare}>${p.fare.toFixed(2)}</Text>
              </Row>
              <View style={{ height: 12 }} />
              <Row>
                <Button
                  title="Decline"
                  variant="secondary"
                  onPress={() => setDismissed((d) => ({ ...d, [p.id]: true }))}
                  fullWidth={false}
                  style={{ flex: 1, marginRight: 6 }}
                />
                <Button
                  title="Accept"
                  disabled={!fits}
                  onPress={() => acceptPassenger(p)}
                  fullWidth={false}
                  style={{ flex: 1, marginLeft: 6 }}
                />
              </Row>
            </Card>
          );
        })
      )}

      <View style={{ height: 8 }} />
      <Button
        title="Start driving"
        disabled={(activeRide.passengers ?? []).length === 0}
        onPress={() => navigate('active_ride')}
      />
      <Button title="Cancel trip" variant="ghost" onPress={cancelRide} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 14, paddingBottom: 64 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  fare: { fontSize: 18, fontWeight: '700', color: colors.text },
  acceptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
