import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, H2, Muted, Pill, Row, colors } from '../components/ui';
import { api } from '../api';
import { useApp } from '../state/AppContext';
import type { ServerParticipants, ServerProfile } from '../types';

const STATUS_COPY: Record<string, { title: string; sub: string }> = {
  active: { title: 'Trip active', sub: 'Waiting to start.' },
  pending: { title: 'Searching…', sub: 'Looking for a carpool match.' },
  matched: { title: 'Matched', sub: 'Driver is preparing to head out.' },
  in_progress: { title: 'On the road', sub: 'Enjoy the ride!' },
  completed: { title: 'Completed', sub: 'Thanks for riding.' },
  cancelled: { title: 'Cancelled', sub: '' },
};

export function ActiveRideScreen() {
  const { active, user, token, navigate, riderCancel, driverComplete, driverCancel } = useApp();
  const [participants, setParticipants] = useState<ServerParticipants | null>(null);

  const tripId = active
    ? active.kind === 'rider'
      ? active.data.trip?.id ?? null
      : active.data.trip.id
    : null;

  const loadParticipants = useCallback(async () => {
    if (!token || !tripId) return;
    try {
      const res = await api.participants(token, tripId);
      setParticipants(res);
    } catch {
      setParticipants(null);
    }
  }, [token, tripId]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

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

  const companions: ServerProfile[] = participants
    ? [
        participants.driver,
        ...participants.riders.map((r) => r.profile),
      ].filter((p) => p.id !== user?.id)
    : [];

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

      {companions.length > 0 && (
        <Card>
          <H2>Travel companions</H2>
          {companions.map((c) => (
            <Pressable
              key={c.id}
              onPress={() =>
                navigate('user_profile', {
                  user_id: c.id,
                  back_to: 'active_ride',
                })
              }
              style={styles.compRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                {c.vehicle ? <Muted>{c.vehicle}</Muted> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {c.rating_count > 0 ? (
                  <Text style={styles.fareSmall}>
                    ★ {c.rating_avg?.toFixed(1)}{' '}
                    <Text style={styles.muted}>({c.rating_count})</Text>
                  </Text>
                ) : (
                  <Muted>No ratings</Muted>
                )}
                <Text style={styles.tap}>Tap profile ›</Text>
              </View>
            </Pressable>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 14, paddingBottom: 64 },
  place: { fontSize: 16, fontWeight: '700', color: colors.text },
  arrow: { fontSize: 24, color: colors.subtle, marginHorizontal: 8 },
  eta: { fontSize: 26, fontWeight: '700', color: colors.text },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fareSmall: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { color: colors.subtle, fontWeight: '500', fontSize: 14 },
  tap: { color: colors.subtle, fontSize: 12, marginTop: 2 },
});
