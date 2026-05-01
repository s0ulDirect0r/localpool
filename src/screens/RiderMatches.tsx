import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, Muted, Pill, Row, colors } from '../components/ui';
import { useApp } from '../state/AppContext';
import { generateDriverMatches } from '../state/mock';

export function RiderMatchesScreen() {
  const { activeRide, selectDriver, cancelRide } = useApp();

  const matches = useMemo(() => {
    if (!activeRide) return [];
    return generateDriverMatches(activeRide.pickup, activeRide.dropoff, activeRide.seats);
  }, [activeRide]);

  if (!activeRide) return null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={styles.container}>
      <Pressable onPress={cancelRide}>
        <Text style={styles.back}>‹ Cancel</Text>
      </Pressable>
      <View>
        <H1>Carpool matches</H1>
        <Muted>
          {activeRide.pickup.label} → {activeRide.dropoff.label} · {activeRide.seats} seat
          {activeRide.seats > 1 ? 's' : ''}
        </Muted>
      </View>

      {matches.length === 0 ? (
        <Card>
          <Muted>No matches yet — try fewer seats or a different destination.</Muted>
        </Card>
      ) : (
        matches.map((d) => {
          const sharing = d.totalSeats - d.seatsLeft > 0;
          return (
            <Card key={d.id}>
              <Row>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.name}>{d.name}</Text>
                  <Muted>★ {d.rating} · {d.vehicle}</Muted>
                  <Muted>Route: {d.route}</Muted>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.fare}>${d.fare.toFixed(2)}</Text>
                  <Muted>ETA {d.etaMinutes} min</Muted>
                </View>
              </Row>
              <View style={{ height: 10 }} />
              <Row>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pill label={`+${d.detourMinutes}min detour`} />
                  <Pill
                    label={sharing ? 'Sharing' : 'Solo first'}
                    tone={sharing ? 'good' : 'warn'}
                  />
                  <Pill label={`${d.seatsLeft}/${d.totalSeats} open`} />
                </View>
              </Row>
              <View style={{ height: 12 }} />
              <Button title="Select" onPress={() => selectDriver(d)} />
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 14, paddingBottom: 64 },
  back: { fontSize: 16, color: colors.subtle },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  fare: { fontSize: 22, fontWeight: '700', color: colors.text },
});
