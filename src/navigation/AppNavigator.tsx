import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DeckImportScreen from '../screens/DeckImportScreen';
import CardQueueScreen from '../screens/CardQueueScreen';
import SongCandidatesScreen from '../screens/SongCandidatesScreen';
import CaptureScreen from '../screens/CaptureScreen';
import ExportScreen from '../screens/ExportScreen';

const Stack = createNativeStackNavigator();

interface Props {
  accessToken: string | null;
}

const screenOptions = {
  headerStyle: { backgroundColor: '#121212' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' as const },
  contentStyle: { backgroundColor: '#121212' },
};

export default function AppNavigator({ accessToken }: Props) {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="DeckImport"
        component={DeckImportScreen}
        options={{ title: 'Decks', headerShown: false }}
      />
      <Stack.Screen
        name="CardQueue"
        component={CardQueueScreen}
        options={({ route }: any) => ({
          title: route.params?.deckName || 'Cards',
        })}
      />
      <Stack.Screen
        name="SongCandidates"
        options={{ title: 'Find Songs' }}
      >
        {(props: any) => (
          <SongCandidatesScreen {...props} accessToken={accessToken} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Capture" options={{ title: 'Capture Timestamp' }}>
        {(props: any) => (
          <CaptureScreen {...props} accessToken={accessToken} />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Export"
        component={ExportScreen}
        options={{ title: 'Export' }}
      />
    </Stack.Navigator>
  );
}
