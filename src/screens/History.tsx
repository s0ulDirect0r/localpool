import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, H1, Muted, Pill, Row, colors } from '../components/ui';
import { useApp } from '../state/AppContext';

export function HistoryScreen() {
  const { history, navigate } = useApp();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={styles.container}>
      <Pressable onPress={() => navigate('home')}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <H1>Ride history</H1>

      {history.length === 0 ? (
        <Card>
          <Muted>You haven't taken or driven any rides yet.</Muted>
        </Card>
      ) : (
        history.map((r) => (
          <Card key={r.id}>
            <Row>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  {r.pickup.label} → {r.dropoff.label}
                </Text>
                <Muted>{new Date(r.createdAt).toLocaleString()}</Muted>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.fare}>${r.fare.toFixed(2)}</Text>
                <Pill
                  label={r.status}
                  tone={r.status === 'completed' ? 'good' : r.status === 'cancelled' ? 'warn' : 'default'}
                />
              </View>
            </Row>
            <View style={{ height: 6 }} />
            <Muted>
              {r.role === 'rider' ? 'As rider' : 'As driver'} ·{' '}
              {r.role === 'driver'
                ? `${(r.passengers ?? []).length} passengers`
                : r.driver
                ? `with ${r.driver.name}`
                : 'unmatched'}
            </Muted>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 14, paddingBottom: 64 },
  back: { fontSize: 16, color: colors.subtle },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  fare: { fontSize: 18, fontWeight: '700', color: colors.text },
});
