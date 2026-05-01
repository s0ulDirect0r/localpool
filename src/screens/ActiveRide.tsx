import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, H2, Muted, Pill, Row, colors } from '../components/ui';
import { useApp } from '../state/AppContext';

const STATUS_COPY: Record<string, { title: string; sub: string }> = {
  active: { title: 'Trip active', sub: 'Waiting to start.' },
  pending: { title: 'Searching…', sub: 'Looking for a carpool match.' },
  matched: { title: 'Matched', sub: 'Driver is preparing to head out.' },
  in_progress: { title: 'On the road', sub: 'Enjoy the ride!' },
  completed: { title: 'Completed', sub: 'Thanks for riding.' },
  cancelled: { title: 'Cancelled', sub: '' },
};

export function ActiveRideScreen() {
  const { active, mode, riderCancel, driverComplete, driverCancel } = useApp();
  if (!active) return null;

  const isDriver = active.kind === 'driver';
  const status = isDriver ? active.data.trip.status : active.data.request.status;
  const meta = STATUS_COPY[status] ?? STATUS_COPY.matched;

  const pickupLabel = isDriver ? active.data.trip.pickup_label : active.data.request.pickup_label;
  const dropoffLabel = isDriver
    ? active.data.trip.dropoff_label
    : active.data.request.dropoff_label;

  const fare = isDriver
    ? active.data.requests.reduce((s, r) => s + (r.status !== 'cancelled' ? r.fare : 0), 0)
    : active.data.request.fare;

  const seatsInfo = isDriver
    ? `${active.data.trip.seats_total - active.data.trip.seats_available} / ${active.data.trip.seats_total}`
    : `${active.data.request.seats}`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={styles.container}
    >
      <View style={{ gap: 6 }}>
        <Pill label={isDriver ? 'Driver' : 'Rider'} tone={isDriver ? 'warn' : 'good'} />
        <H1>{meta.title}</H1>
        <Muted>{meta.sub}</Muted>
      </View>

      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Muted>Pickup</Muted>
            <Text style={styles.place}>{pickupLabel}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Muted>Drop-off</Muted>
            <Text style={styles.place}>{dropoffLabel}</Text>
          </View>
        </Row>
      </Card>

      {!isDriver && active.data.trip?.driver && (
        <Card>
          <H2>Your driver</H2>
          <Text style={styles.name}>{active.data.trip.driver.name}</Text>
          {active.data.trip.driver.vehicle && (
            <Muted>{active.data.trip.driver.vehicle}</Muted>
          )}
        </Card>
      )}

      {isDriver && active.data.requests.length > 0 && (
        <Card>
          <H2>Passengers</H2>
          {active.data.requests
            .filter((r) => r.status !== 'cancelled')
            .map((p) => (
              <View key={p.id} style={styles.paxRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.rider?.name ?? 'Rider'}</Text>
                  <Muted>
                    {p.pickup_label} → {p.dropoff_label}
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
            <Text style={styles.eta}>${fare.toFixed(2)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Muted>Seats</Muted>
            <Text style={styles.fareSmall}>{seatsInfo}</Text>
          </View>
        </Row>
      </Card>

      <View style={{ gap: 10 }}>
        {isDriver && status === 'in_progress' && (
          <Button title="Mark trip complete" onPress={driverComplete} />
        )}
        {isDriver && status !== 'in_progress' && (
          <Button title="Cancel trip" variant="danger" onPress={driverCancel} />
        )}
        {!isDriver && status !== 'in_progress' && status !== 'completed' && (
          <Button title="Cancel ride" variant="danger" onPress={riderCancel} />
        )}
        {!isDriver && status === 'in_progress' && (
          <Muted>The driver will mark the ride complete when you arrive.</Muted>
        )}
      </View>

      {/* mode is unused but referenced to silence lint when toggled in profile */}
      {mode === 'rider' && null}
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
});
