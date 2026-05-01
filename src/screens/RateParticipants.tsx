import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, Card, H1, H2, Muted, Pill, Row, colors } from '../components/ui';
import { ApiError, api } from '../api';
import { useApp } from '../state/AppContext';
import type { ServerParticipants, ServerProfile, ServerRating } from '../types';

type Subject = { profile: ServerProfile; role: 'driver' | 'rider' };

export function RateParticipantsScreen() {
  const { token, user, screenParams, navigate, clearLastCompletedTrip } = useApp();
  const tripId = screenParams.trip_id;
  const backTo = screenParams.back_to ?? 'home';

  const [participants, setParticipants] = useState<ServerParticipants | null>(null);
  const [submitted, setSubmitted] = useState<ServerRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !tripId) return;
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        api.participants(token, tripId),
        api.ratingsForTrip(token, tripId),
      ]);
      setParticipants(p);
      setSubmitted(r.submitted);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.code.replace(/_/g, ' ') : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token, tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const goBack = () => {
    clearLastCompletedTrip();
    navigate(backTo);
  };

  if (!tripId) return null;

  const subjects: Subject[] = participants
    ? [
        { profile: participants.driver, role: 'driver' as const },
        ...participants.riders.map((r) => ({ profile: r.profile, role: 'rider' as const })),
      ].filter((s) => s.profile.id !== user?.id)
    : [];

  const ratedIds = new Set(submitted.map((r) => r.ratee_id));
  const allRated = subjects.length > 0 && subjects.every((s) => ratedIds.has(s.profile.id));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={goBack}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <View>
          <H1>Rate your trip</H1>
          <Muted>Honest ratings help everyone find good carpool company.</Muted>
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : loadError ? (
          <Card>
            <Muted>{loadError}</Muted>
          </Card>
        ) : subjects.length === 0 ? (
          <Card>
            <Muted>No one to rate.</Muted>
          </Card>
        ) : (
          subjects.map((s) => (
            <RatingCard
              key={s.profile.id}
              subject={s}
              tripId={tripId}
              token={token!}
              alreadyRated={ratedIds.has(s.profile.id)}
              onSubmitted={(r) => setSubmitted((prev) => [...prev, r])}
              onOpenProfile={() =>
                navigate('user_profile', {
                  user_id: s.profile.id,
                  back_to: 'rate_participants',
                  trip_id: tripId,
                })
              }
            />
          ))
        )}

        <View style={{ height: 8 }} />
        <Button
          title={allRated ? 'Done — back home' : 'Skip the rest'}
          variant={allRated ? 'primary' : 'secondary'}
          onPress={goBack}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RatingCard({
  subject,
  tripId,
  token,
  alreadyRated,
  onSubmitted,
  onOpenProfile,
}: {
  subject: Subject;
  tripId: string;
  token: string;
  alreadyRated: boolean;
  onSubmitted: (r: ServerRating) => void;
  onOpenProfile: () => void;
}) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadyRated);

  const submit = async () => {
    if (busy || done) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.submitRating(token, tripId, {
        ratee_id: subject.profile.id,
        stars,
        comment: comment.trim() || undefined,
      });
      onSubmitted(res.rating);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.code.replace(/_/g, ' ') : 'Failed to submit');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Row>
        <Pressable onPress={onOpenProfile} style={{ flex: 1 }}>
          <Text style={styles.name}>{subject.profile.name}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            <Pill
              label={subject.role === 'driver' ? 'Driver' : 'Rider'}
              tone={subject.role === 'driver' ? 'warn' : 'good'}
            />
            {subject.profile.rating_count > 0 && (
              <Pill
                label={`★ ${subject.profile.rating_avg?.toFixed(1)} (${subject.profile.rating_count})`}
              />
            )}
          </View>
        </Pressable>
      </Row>

      {done ? (
        <View style={{ marginTop: 10 }}>
          <Muted>Thanks — rating submitted.</Muted>
        </View>
      ) : (
        <>
          <View style={{ height: 12 }} />
          <StarPicker value={stars} onChange={setStars} />
          <View style={{ height: 8 }} />
          <TextInput
            placeholder="Optional comment"
            placeholderTextColor="#999"
            value={comment}
            onChangeText={setComment}
            style={styles.input}
            multiline
          />
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <View style={{ height: 10 }} />
          <Button
            title="Submit rating"
            onPress={submit}
            loading={busy}
          />
        </>
      )}
    </Card>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          style={[styles.star, n <= value && styles.starActive]}
        >
          <Text style={[styles.starText, n <= value && styles.starTextActive]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 14, paddingBottom: 64 },
  back: { fontSize: 16, color: colors.subtle },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  star: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  starText: { fontSize: 22, color: colors.subtle },
  starTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 60,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  errorBox: {
    backgroundColor: '#fde8e8',
    borderColor: '#f5a3a3',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  errorText: { color: '#7a1212', fontWeight: '600' },
});
