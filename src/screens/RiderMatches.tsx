import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, Muted, Pill, Row, colors } from '../components/ui';
import { ApiError, api } from '../api';
import { useApp } from '../state/AppContext';
import type { ServerMatch } from '../types';

export function RiderMatchesScreen() {
  const { token, active, riderJoin, riderCancel } = useApp();
  const [matches, setMatches] = useState<ServerMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!token || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await api.riderMatches(token);
      setMatches(res.matches);
      setLoadError(null);
    } catch (e) {
      // Keep whatever we had; a dead server is not "no matches".
      setLoadError(
        e instanceof ApiError && e.code === 'network_error'
          ? 'Cannot reach the server — is it running?'
          : 'Failed to load matches — retrying…',
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [load]);

  if (!active || active.kind !== 'rider') return null;
  const req = active.data.request;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={styles.container}
    >
      <Pressable onPress={riderCancel}>
        <Text style={styles.back}>‹ Cancel</Text>
      </Pressable>
      <View>
        <H1>Carpool matches</H1>
        <Muted>
          {req.pickup_label} → {req.dropoff_label} · {req.seats} seat
          {req.seats > 1 ? 's' : ''}
        </Muted>
      </View>

      {loadError ? (
        <Card style={{ borderColor: '#f5a3a3' }}>
          <Text style={styles.errorText}>{loadError}</Text>
        </Card>
      ) : null}
      {joinError ? (
        <Card style={{ borderColor: '#f5a3a3' }}>
          <Text style={styles.errorText}>{joinError}</Text>
        </Card>
      ) : null}

      {loading && matches.length === 0 && !loadError ? (
        <Card>
          <ActivityIndicator />
        </Card>
      ) : matches.length === 0 && !loadError ? (
        <Card>
          <Muted>No matches yet — we'll keep looking. Pull a driver online to test.</Muted>
        </Card>
      ) : (
        matches.map((m) => {
          const t = m.trip;
          const seatsTaken = t.seats_total - t.seats_available;
          const sharing = seatsTaken > 0;
          return (
            <Card key={t.id}>
              <Row>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.name}>{t.driver?.name ?? 'Driver'}</Text>
                  {t.driver?.vehicle && <Muted>{t.driver.vehicle}</Muted>}
                  <Muted>
                    Heading {t.pickup_label} → {t.dropoff_label}
                  </Muted>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.fare}>${m.fare.toFixed(2)}</Text>
                  <Muted>~{Math.max(1, Math.round(m.score * 4))} min</Muted>
                </View>
              </Row>
              <View style={{ height: 10 }} />
              <Row>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Pill
                    label={sharing ? 'Sharing' : 'You\'d be first'}
                    tone={sharing ? 'good' : 'warn'}
                  />
                  <Pill label={`${t.seats_available}/${t.seats_total} open`} />
                </View>
              </Row>
              <View style={{ height: 12 }} />
              <Button
                title={joiningId === t.id ? 'Joining…' : 'Join this carpool'}
                loading={joiningId === t.id}
                disabled={!!joiningId}
                onPress={async () => {
                  setJoiningId(t.id);
                  setJoinError(null);
                  try {
                    await riderJoin(t.id);
                  } catch (e) {
                    setJoinError(
                      e instanceof ApiError && e.code === 'not_enough_seats'
                        ? 'That carpool just filled up — pick another.'
                        : 'Could not join — try again.',
                    );
                    load();
                  } finally {
                    setJoiningId(null);
                  }
                }}
              />
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
  errorText: { color: '#7a1212', fontWeight: '600' },
});
