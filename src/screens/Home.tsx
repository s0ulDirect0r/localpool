import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H1, H2, Muted, Pill, Row, colors } from '../components/ui';
import { useApp } from '../state/AppContext';
import type { Mode } from '../types';

export function HomeScreen() {
  const { user, mode, setMode, navigate, activeRide, history } = useApp();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={styles.container}>
      <View style={{ gap: 4 }}>
        <Muted>Welcome back</Muted>
        <H1>{user?.name ?? 'there'}</H1>
      </View>

      <ModeToggle value={mode} onChange={setMode} />

      {activeRide && (
        <Card style={{ borderColor: colors.accent }}>
          <Row>
            <H2>Active ride</H2>
            <Pill label={activeRide.status.replace('_', ' ')} tone="good" />
          </Row>
          <Muted>
            {activeRide.pickup.label} → {activeRide.dropoff.label}
          </Muted>
          <View style={{ height: 10 }} />
          <Button title="Open ride" onPress={() => navigate('active_ride')} />
        </Card>
      )}

      {mode === 'rider' ? (
        <Card>
          <H2>Need a ride?</H2>
          <Muted>Find neighbors heading the same way and split the fare.</Muted>
          <View style={{ height: 12 }} />
          <Button
            title="Request a carpool"
            onPress={() => navigate('rider_request')}
            disabled={!!activeRide}
          />
        </Card>
      ) : (
        <Card>
          <H2>Driving today?</H2>
          <Muted>Set your route and pick up passengers along the way.</Muted>
          <View style={{ height: 12 }} />
          <Button
            title="Start a trip"
            onPress={() => navigate('driver_setup')}
            disabled={!!activeRide}
          />
        </Card>
      )}

      <Card>
        <Row>
          <H2>Recent rides</H2>
          <Pressable onPress={() => navigate('history')}>
            <Text style={styles.link}>See all</Text>
          </Pressable>
        </Row>
        {history.length === 0 ? (
          <Muted>No rides yet.</Muted>
        ) : (
          history.slice(0, 3).map((r) => (
            <View key={r.id} style={styles.historyItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>
                  {r.pickup.label} → {r.dropoff.label}
                </Text>
                <Muted>
                  {r.role === 'rider' ? 'Rider' : 'Driver'} · {r.status} · ${r.fare.toFixed(2)}
                </Muted>
              </View>
            </View>
          ))
        )}
      </Card>

      <Row>
        <Button
          title="Profile"
          variant="secondary"
          onPress={() => navigate('profile')}
          style={{ flex: 1, marginRight: 6 }}
          fullWidth={false}
        />
        <Button
          title="History"
          variant="secondary"
          onPress={() => navigate('history')}
          style={{ flex: 1, marginLeft: 6 }}
          fullWidth={false}
        />
      </Row>
    </ScrollView>
  );
}

function ModeToggle({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <View style={styles.toggle}>
      <Tab label="Rider" active={value === 'rider'} onPress={() => onChange('rider')} />
      <Tab label="Driver" active={value === 'driver'} onPress={() => onChange('driver')} />
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
      accessibilityRole="button"
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 64,
    gap: 18,
    paddingBottom: 64,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 999,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  tabText: { fontWeight: '600', color: colors.subtle },
  tabTextActive: { color: colors.text },
  link: { color: colors.text, fontWeight: '600' },
  historyItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
});
