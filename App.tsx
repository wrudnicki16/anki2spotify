import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { useSpotifyAuth } from './src/hooks/useSpotifyAuth';
import AppNavigator from './src/navigation/AppNavigator';

function AppContent() {
  const { accessToken, isAuthenticated, login, logout, isReady } = useSpotifyAuth();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: '#1DB954',
            background: '#121212',
            card: '#121212',
            text: '#fff',
            border: '#2a2a2a',
            notification: '#1DB954',
          },
          fonts: {
            regular: { fontFamily: 'System', fontWeight: '400' },
            medium: { fontFamily: 'System', fontWeight: '500' },
            bold: { fontFamily: 'System', fontWeight: '700' },
            heavy: { fontFamily: 'System', fontWeight: '900' },
          },
        }}
      >
        {/* Spotify auth bar */}
        <View style={[styles.authBar, { paddingTop: insets.top + 24 }]}>
          {isAuthenticated ? (
            <View style={styles.authRow}>
              <View style={styles.connectedDot} />
              <Text style={styles.authText}>Spotify Connected</Text>
              <TouchableOpacity onPress={logout}>
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.loginButton, !isReady && styles.loginButtonDisabled]}
              onPress={login}
              disabled={!isReady}
            >
              <Text style={styles.loginText}>
                {isReady ? 'Connect Spotify' : 'Loading...'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <AppNavigator accessToken={accessToken} />
      </NavigationContainer>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  authBar: {
    backgroundColor: '#1e1e1e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  authRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1DB954',
    marginRight: 8,
  },
  authText: {
    color: '#1DB954',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  logoutText: {
    color: '#b3b3b3',
    fontSize: 13,
  },
  loginButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
