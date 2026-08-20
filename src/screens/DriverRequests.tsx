import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, H2, Muted, Pill, Row, colors } from '../components/ui';
import { api } from '../api';
import { useApp } from '../state/AppContext';
import type { ServerRequestRow, ServerUser } from '../types';

type PendingItem = {
  request: ServerRequestRow & { rider: ServerUser | null };
  score: number;
};

export function DriverRequestsScreen() {
  const { token, active, driverAccept, driverStart, driverCancel } = useApp();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!token || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await api.driverRequests(token);
      setPending(res.requests);
    } catch {
      // Keep the last known list; polling will retry.
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const i = setInterval(load, 4000);
    return () => clearInterval(i);
  }, [load]);

  if (!active || active.kind !== 'driver') return null;
  const trip = active.data.trip;
  const accepted = active.data.requests.filter((r) => r.status === 'matched');
  const earnings = accepted.reduce((s, r) => s + r.fare, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={styles.container}
    >
      <H1>Looking for riders</H1>
      <Muted>
        {trip.pickup_label} → {trip.dropoff_label} · {trip.seats_available} seat
        {trip.seats_available === 1 ? '' : 's'} open
      </Muted>

      <Card>
        <Row>
          <H2>Accepted</H2>
          <Pill label={`$${earnings.toFixed(2)} potential`} tone="good" />
        </Row>
        {accepted.length === 0 ? (
          <Muted>No passengers yet — accept requests below.</Muted>
        ) : (
          accepted.map((p) => (
            <View key={p.id} style={styles.acceptedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.rider?.name ?? 'Rider'}</Text>
                <Muted>
                  {p.pickup_label} → {p.dropoff_label} · {p.seats} seat
                  {p.seats === 1 ? '' : 's'}
                </Muted>
              </View>
              <Text style={styles.fare}>+${p.fare.toFixed(2)}</Text>
            </View>
          ))
        )}
      </Card>

      <H2>Nearby requests</H2>
      {acceptError ? (
        <Card style={{ borderColor: '#f5a3a3' }}>
          <Text style={styles.errorText}>{acceptError}</Text>
        </Card>
      ) : null}
      {loading && pending.length === 0 ? (
        <Card>
          <ActivityIndicator />
        </Card>
      ) : pending.length === 0 ? (
        <Card>
          <Muted>No pending requests right now. We'll keep checking.</Muted>
        </Card>
      ) : (
        pending.map((p) => {
          const fits = p.request.seats <= trip.seats_available;
          return (
            <Card key={p.request.id}>
              <Row>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.name}>{p.request.rider?.name ?? 'Rider'}</Text>
                  <Muted>
                    {p.request.pickup_label} → {p.request.dropoff_label}
                  </Muted>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <Pill label={`${p.request.seats} seat${p.request.seats === 1 ? '' : 's'}`} />
                    {!fits && <Pill label="Not enough seats" tone="warn" />}
                  </View>
                </View>
                <Text style={styles.fare}>${p.request.fare.toFixed(2)}</Text>
              </Row>
              <View style={{ height: 12 }} />
              <Button
                title={acceptingId === p.request.id ? 'Accepting…' : 'Accept'}
                disabled={!fits || !!acceptingId}
                loading={acceptingId === p.request.id}
                onPress={async () => {
                  setAcceptingId(p.request.id);
                  setAcceptError(null);
                  try {
                    await driverAccept(p.request.id);
                    await load();
                  } catch {
                    setAcceptError('Could not accept — the request may have been taken or cancelled.');
                    load();
                  } finally {
                    setAcceptingId(null);
                  }
                }}
              />
            </Card>
          );
        })
      )}

      <View style={{ height: 8 }} />
      <Button
        title="Start driving"
        disabled={accepted.length === 0}
        onPress={driverStart}
      />
      <Button title="Cancel trip" variant="ghost" onPress={driverCancel} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 14, paddingBottom: 64 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  fare: { fontSize: 18, fontWeight: '700', color: colors.text },
  errorText: { color: '#7a1212', fontWeight: '600' },
  acceptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
