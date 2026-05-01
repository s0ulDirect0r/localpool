import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { ActiveRideScreen } from './src/screens/ActiveRide';
import { DriverRequestsScreen } from './src/screens/DriverRequests';
import { DriverSetupScreen } from './src/screens/DriverSetup';
import { HistoryScreen } from './src/screens/History';
import { HomeScreen } from './src/screens/Home';
import { ProfileScreen } from './src/screens/Profile';
import { RiderMatchesScreen } from './src/screens/RiderMatches';
import { RiderRequestScreen } from './src/screens/RiderRequest';
import { SignInScreen } from './src/screens/SignIn';
import { SignUpScreen } from './src/screens/SignUp';
import { WelcomeScreen } from './src/screens/Welcome';
import { AppProvider, useApp } from './src/state/AppContext';

function Router() {
  const { screen, loaded, user } = useApp();

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    if (screen === 'signup') return <SignUpScreen />;
    if (screen === 'signin') return <SignInScreen />;
    return <WelcomeScreen />;
  }

  switch (screen) {
    case 'rider_request':
      return <RiderRequestScreen />;
    case 'rider_matches':
      return <RiderMatchesScreen />;
    case 'driver_setup':
      return <DriverSetupScreen />;
    case 'driver_requests':
      return <DriverRequestsScreen />;
    case 'active_ride':
      return <ActiveRideScreen />;
    case 'history':
      return <HistoryScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'home':
    default:
      return <HomeScreen />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <Router />
      </SafeAreaView>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
