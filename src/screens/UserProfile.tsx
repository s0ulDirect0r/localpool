import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, H1, H2, Muted, Pill, Row, colors } from '../components/ui';
import { api, ApiError } from '../api';
import { useApp } from '../state/AppContext';
import type { ServerProfile } from '../types';

function Stars({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) return <Muted>No ratings yet</Muted>;
  const filled = Math.round(avg);
  const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);
  return (
    <Text style={styles.stars}>
      {stars} <Text style={styles.starsMeta}>{avg.toFixed(2)} · {count} rating{count === 1 ? '' : 's'}</Text>
    </Text>
  );
}

export function UserProfileScreen() {
  const { token, screenParams, navigate } = useApp();
  const userId = screenParams.user_id;
  const backTo = screenParams.back_to ?? 'home';
  const [profile, setProfile] = useState<ServerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.userProfile(token, userId);
      setProfile(res.profile);
    } catch (e) {
      setError(e instanceof ApiError ? e.code.replace(/_/g, ' ') : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={styles.container}>
      <Pressable
        onPress={() =>
          // Forward trip_id so screens that need it (rate_participants)
          // don't come back blank.
          navigate(backTo, { trip_id: screenParams.trip_id })
        }
      >
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Card>
          <Muted>{error}</Muted>
        </Card>
      ) : profile ? (
        <>
          <View style={{ gap: 6 }}>
            <H1>{profile.name}</H1>
            <Stars avg={profile.rating_avg} count={profile.rating_count} />
          </View>

          {profile.bio ? (
            <Card>
              <H2>About</H2>
              <Text style={styles.bio}>{profile.bio}</Text>
            </Card>
          ) : null}

          {profile.vehicle ? (
            <Card>
              <H2>Vehicle</H2>
              <Text style={styles.bio}>{profile.vehicle}</Text>
            </Card>
          ) : null}

          <Card>
            <Row>
              <View>
                <Muted>Rides as rider</Muted>
                <Text style={styles.stat}>{profile.rides_as_rider}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Muted>Rides as driver</Muted>
                <Text style={styles.stat}>{profile.rides_as_driver}</Text>
              </View>
            </Row>
          </Card>

          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {profile.rides_as_driver > 0 && <Pill label="Driver" tone="warn" />}
            {profile.rides_as_rider > 0 && <Pill label="Rider" tone="good" />}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 14, paddingBottom: 64 },
  back: { fontSize: 16, color: colors.subtle },
  stars: { fontSize: 18, color: colors.text, fontWeight: '700' },
  starsMeta: { color: colors.subtle, fontWeight: '500', fontSize: 14 },
  bio: { color: colors.text, fontSize: 15, marginTop: 4 },
  stat: { fontSize: 22, fontWeight: '700', color: colors.text },
});
