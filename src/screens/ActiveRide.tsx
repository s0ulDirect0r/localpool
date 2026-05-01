import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, H2, Muted, Pill, Row, colors } from '../components/ui';
import { useApp } from '../state/AppContext';

const STATUS_COPY: Record<string, { title: string; sub: string }> = {
  searching: { title: 'Searching…', sub: 'Looking for a carpool match.' },
  matched: { title: 'Match found', sub: 'Confirming your driver.' },
  driver_en_route: { title: 'Driver on the way', sub: 'Heading to your pickup.' },
  in_progress: { title: 'On the road', sub: 'Enjoy the ride!' },
  completed: { title: 'Completed', sub: 'Thanks for riding.' },
  cancelled: { title: 'Cancelled', sub: '' },
};

export function ActiveRideScreen() {
  const { activeRide, completeRide, cancelRide } = useApp();
  if (!activeRide) return null;

  const meta = STATUS_COPY[activeRide.status] ?? STATUS_COPY.searching;
  const isDriver = activeRide.role === 'driver';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={styles.container}>
      <View style={{ gap: 6 }}>
        <Pill
          label={isDriver ? 'Driver' : 'Rider'}
          tone={isDriver ? 'warn' : 'good'}
        />
        <H1>{meta.title}</H1>
        <Muted>{meta.sub}</Muted>
      </View>

      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Muted>Pickup</Muted>
            <Text style={styles.place}>{activeRide.pickup.label}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Muted>Drop-off</Muted>
            <Text style={styles.place}>{activeRide.dropoff.label}</Text>
          </View>
        </Row>
      </Card>

      {activeRide.status === 'driver_en_route' && (
        <Card>
          <Row>
            <H2>ETA</H2>
            <Text style={styles.eta}>
              {activeRide.etaMinutes ?? 0} min
            </Text>
          </Row>
          <Muted>Updates every 2 seconds (demo).</Muted>
        </Card>
      )}

      {activeRide.status === 'in_progress' && (
        <Card>
          <H2>Trip progress</H2>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${activeRide.progressPct ?? 0}%` }]}
            />
          </View>
          <Muted>{activeRide.progressPct ?? 0}% complete</Muted>
        </Card>
      )}

      {!isDriver && activeRide.driver && (
        <Card>
          <H2>Your driver</H2>
          <Text style={styles.name}>{activeRide.driver.name}</Text>
          <Muted>★ {activeRide.driver.rating} · {activeRide.driver.vehicle}</Muted>
        </Card>
      )}

      {isDriver && (activeRide.passengers ?? []).length > 0 && (
        <Card>
          <H2>Passengers</H2>
          {(activeRide.passengers ?? []).map((p) => (
            <View key={p.id} style={styles.paxRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Muted>
                  {p.pickup.label} → {p.dropoff.label}
                </Muted>
              </View>
              <Text style={styles.fareSmall}>+${p.fare.toFixed(2)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card style={{ backgroundColor: colors.surface }}>
        <Row>
          <View>
            <Muted>{isDriver ? 'Earnings' : 'Fare'}</Muted>
            <Text style={styles.eta}>${activeRide.fare.toFixed(2)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Muted>Seats</Muted>
            <Text style={styles.fareSmall}>
              {isDriver
                ? `${(activeRide.passengers ?? []).reduce((s, p) => s + p.seats, 0)} / ${activeRide.seats}`
                : activeRide.seats}
            </Text>
          </View>
        </Row>
      </Card>

      <View style={{ gap: 10 }}>
        {activeRide.status === 'in_progress' && (
          <Button title="Mark trip complete" onPress={completeRide} />
        )}
        {activeRide.status !== 'in_progress' && (
          <Button title="Cancel" variant="danger" onPress={cancelRide} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 14, paddingBottom: 64 },
  place: { fontSize: 16, fontWeight: '700', color: colors.text },
  arrow: { fontSize: 24, color: colors.subtle, marginHorizontal: 8 },
  eta: { fontSize: 26, fontWeight: '700', color: colors.text },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  paxRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fareSmall: { fontSize: 16, fontWeight: '700', color: colors.text },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: 999,
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },
});
