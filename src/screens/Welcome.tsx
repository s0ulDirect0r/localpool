import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, H1, Muted } from '../components/ui';
import { useApp } from '../state/AppContext';

export function WelcomeScreen() {
  const { navigate } = useApp();
  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Text style={styles.logo}>LocalPool</Text>
        <Muted>Carpooling, simplified.</Muted>
      </View>
      <View style={{ gap: 12 }}>
        <H1>Share the ride.{'\n'}Split the cost.</H1>
        <Muted>
          A ride-share built around carpooling — match with neighbors going your way and pay
          a fraction of a regular fare.
        </Muted>
      </View>
      <View style={{ gap: 10 }}>
        <Button title="Get started" onPress={() => navigate('signup')} />
        <Button
          title="I already have an account"
          variant="secondary"
          onPress={() => navigate('signup')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 64,
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  brand: { gap: 4 },
  logo: { fontSize: 28, fontWeight: '800' },
});
