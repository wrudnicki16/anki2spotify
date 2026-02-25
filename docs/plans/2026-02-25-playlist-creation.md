# Playlist Creation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Create Playlist" button on CardQueueScreen that creates a Spotify playlist from the currently filtered cards, auto-searching for unmatched cards.

**Architecture:** Add playlist auth scope, add Spotify API methods (with retry/backoff) to useSpotify hook, add "Create Playlist" button to CardQueueScreen header, add PlaylistProgress screen for track resolution + playlist creation with deep link to Spotify.

**Tech Stack:** React Native, Expo, expo-sqlite, Spotify Web API

---

### Task 1: Add playlist scope to Spotify auth

**Files:**
- Modify: `src/config/spotify.ts:5-9`

**Step 1: Add the playlist-modify-public scope**

Change lines 5-9:

```typescript
export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state',
];
```

to:

```typescript
export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state',
  'playlist-modify-public',
];
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

**Note:** After this change, users must log out and re-authenticate to grant the new scope.

---

### Task 2: Add playlist API methods to useSpotify hook

**Files:**
- Modify: `src/hooks/useSpotify.ts`

**Context:** The hook currently has `searchTracks`, `getPlaybackState`, `seekToPosition`, `playTrack`. We need to add `getCurrentUser`, `createPlaylist`, and `addTracksToPlaylist`. All new methods should retry on 429 (rate limit) with exponential backoff.

**Step 1: Add a retry-aware fetch helper inside the hook**

Add after the `headers` declaration (line 8), before `searchTracks`:

```typescript
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429 || attempt === maxRetries) return res;
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1', 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000 * (attempt + 1)));
  }
  throw new Error('Max retries exceeded');
};
```

**Step 2: Add getCurrentUser method**

Add after `playTrack` (before the return statement on line 69):

```typescript
const getCurrentUser = async (): Promise<{ id: string } | null> => {
  if (!accessToken) return null;
  try {
    const res = await fetchWithRetry(`${SPOTIFY_API_BASE}/me`, { headers });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};
```

**Step 3: Add createPlaylist method**

Add after `getCurrentUser`:

```typescript
const createPlaylist = async (
  userId: string,
  name: string
): Promise<{ id: string; uri: string; external_urls: { spotify: string } } | null> => {
  if (!accessToken) return null;
  try {
    const res = await fetchWithRetry(`${SPOTIFY_API_BASE}/users/${userId}/playlists`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, public: true }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
};
```

**Step 4: Add addTracksToPlaylist method**

Add after `createPlaylist`. This batches at 100 URIs per request per Spotify API limits:

```typescript
const addTracksToPlaylist = async (
  playlistId: string,
  uris: string[]
): Promise<boolean> => {
  if (!accessToken) return false;
  try {
    for (let i = 0; i < uris.length; i += 100) {
      const batch = uris.slice(i, i + 100);
      const res = await fetchWithRetry(
        `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ uris: batch }),
        }
      );
      if (!res.ok) return false;
    }
    return true;
  } catch {
    return false;
  }
};
```

**Step 5: Update the return statement**

Change line 69:

```typescript
return { searchTracks, getPlaybackState, seekToPosition, playTrack };
```

to:

```typescript
return {
  searchTracks,
  getPlaybackState,
  seekToPosition,
  playTrack,
  getCurrentUser,
  createPlaylist,
  addTracksToPlaylist,
};
```

**Step 6: Verify it compiles**

Run: `npx tsc --noEmit`

---

### Task 3: Create PlaylistProgressScreen

**Files:**
- Create: `src/screens/PlaylistProgressScreen.tsx`

**Context:** This screen receives a playlist name, a list of cards (with status and search field info), and an access token. It resolves track URIs for all cards (using existing URIs for matched cards, searching for unmatched), creates the playlist, adds tracks, and shows a deep link button when done.

**Step 1: Create the screen**

```typescript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { useSpotify } from '../hooks/useSpotify';
import { getTrackForCard } from '../db/database';

interface CardParam {
  id: number;
  front: string;
  back: string;
  status: string;
  searchText: string;
}

interface Props {
  route: any;
  navigation: any;
  accessToken: string | null;
}

type Phase = 'resolving' | 'creating' | 'done' | 'error';

export default function PlaylistProgressScreen({
  route,
  navigation,
  accessToken,
}: Props) {
  const { playlistName, cards } = route.params as {
    playlistName: string;
    cards: CardParam[];
  };

  const {
    searchTracks,
    getCurrentUser,
    createPlaylist,
    addTracksToPlaylist,
  } = useSpotify(accessToken);

  const [phase, setPhase] = useState<Phase>('resolving');
  const [progress, setProgress] = useState(0);
  const [total] = useState(cards.length);
  const [skipped, setSkipped] = useState(0);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [playlistUri, setPlaylistUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const cancelledRef = useRef(false);

  useEffect(() => {
    run();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const run = async () => {
    // Phase 1: Resolve track URIs
    const uris: string[] = [];
    let skippedCount = 0;

    for (let i = 0; i < cards.length; i++) {
      if (cancelledRef.current) return;
      const card = cards[i];
      let uri: string | null = null;

      if (card.status === 'matched') {
        const track = await getTrackForCard(card.id);
        uri = track?.spotify_uri ?? null;
      }

      if (!uri) {
        const results = await searchTracks(card.searchText, 1);
        uri = results[0]?.uri ?? null;
      }

      if (uri) {
        uris.push(uri);
      } else {
        skippedCount++;
      }

      setProgress(i + 1);
      setSkipped(skippedCount);
    }

    if (cancelledRef.current) return;

    if (uris.length === 0) {
      setErrorMessage('No tracks could be found for any cards.');
      setPhase('error');
      return;
    }

    // Phase 2: Create playlist
    setPhase('creating');

    const user = await getCurrentUser();
    if (!user) {
      setErrorMessage('Could not get Spotify user info. Please re-authenticate.');
      setPhase('error');
      return;
    }

    const playlist = await createPlaylist(user.id, playlistName);
    if (!playlist) {
      setErrorMessage('Failed to create playlist on Spotify.');
      setPhase('error');
      return;
    }

    // Phase 3: Add tracks
    const success = await addTracksToPlaylist(playlist.id, uris);
    if (!success) {
      setErrorMessage(
        'Playlist was created but some tracks failed to add. Check Spotify.'
      );
      setPlaylistUrl(playlist.external_urls.spotify);
      setPlaylistUri(playlist.uri);
      setPhase('error');
      return;
    }

    setPlaylistUrl(playlist.external_urls.spotify);
    setPlaylistUri(playlist.uri);
    setPhase('done');
  };

  const openInSpotify = async () => {
    if (!playlistUri && !playlistUrl) return;
    try {
      if (playlistUri) {
        const supported = await Linking.canOpenURL(playlistUri);
        if (supported) {
          await Linking.openURL(playlistUri);
          return;
        }
      }
      if (playlistUrl) await Linking.openURL(playlistUrl);
    } catch {
      if (playlistUrl) await Linking.openURL(playlistUrl);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.playlistName}>{playlistName}</Text>

      {phase === 'resolving' && (
        <>
          <Text style={styles.statusText}>
            Resolving tracks... {progress}/{total}
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${total > 0 ? (progress / total) * 100 : 0}%` },
              ]}
            />
          </View>
          {skipped > 0 && (
            <Text style={styles.skippedText}>
              {skipped} card{skipped !== 1 ? 's' : ''} skipped (no results)
            </Text>
          )}
        </>
      )}

      {phase === 'creating' && (
        <Text style={styles.statusText}>Creating playlist...</Text>
      )}

      {phase === 'done' && (
        <>
          <Text style={styles.successText}>
            Playlist created with {total - skipped} track
            {total - skipped !== 1 ? 's' : ''}!
          </Text>
          {skipped > 0 && (
            <Text style={styles.skippedText}>
              {skipped} card{skipped !== 1 ? 's' : ''} skipped (no results found)
            </Text>
          )}
          <TouchableOpacity style={styles.spotifyButton} onPress={openInSpotify}>
            <Text style={styles.spotifyButtonText}>Open in Spotify</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.popToTop()}
          >
            <Text style={styles.doneButtonText}>Back to Decks</Text>
          </TouchableOpacity>
        </>
      )}

      {phase === 'error' && (
        <>
          <Text style={styles.errorText}>{errorMessage}</Text>
          {playlistUrl && (
            <TouchableOpacity
              style={styles.spotifyButton}
              onPress={openInSpotify}
            >
              <Text style={styles.spotifyButtonText}>Open in Spotify</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneButtonText}>Go Back</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 32,
  },
  statusText: {
    color: '#b3b3b3',
    fontSize: 16,
    marginBottom: 16,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 3,
  },
  skippedText: {
    color: '#f39c12',
    fontSize: 13,
    marginBottom: 8,
  },
  successText: {
    color: '#1DB954',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  spotifyButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  spotifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  doneButton: {
    backgroundColor: '#535353',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

---

### Task 4: Add "Create Playlist" button and confirmation modal to CardQueueScreen

**Files:**
- Modify: `src/screens/CardQueueScreen.tsx`

**Context:** CardQueueScreen currently has a header row with the deck name and an "Export" button. We need to add a "Create Playlist" button next to Export. Tapping it shows a confirmation modal with the count of filtered cards and a hint about adjusting filters. On confirm, navigate to a playlist name prompt (we'll use Alert.prompt for simplicity since this is iOS — or a simple modal with TextInput for cross-platform).

**Step 1: Add imports**

Add `Modal`, `TextInput`, and `Alert` to the react-native import (line 2-8):

```typescript
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
```

**Step 2: Add state for the modal**

After the `lyricsOnly` state (line 28):

```typescript
const [showPlaylistModal, setShowPlaylistModal] = useState(false);
const [showNameModal, setShowNameModal] = useState(false);
const [playlistName, setPlaylistName] = useState(deckName);
```

**Step 3: Add the create playlist handler**

After `toggleSearchField` (line 34):

```typescript
const handleCreatePlaylist = () => {
  if (displayedCards.length === 0) {
    Alert.alert('No cards', 'There are no cards with the current filters.');
    return;
  }
  setShowPlaylistModal(true);
};

const handleConfirmPlaylist = () => {
  setShowPlaylistModal(false);
  setPlaylistName(deckName);
  setShowNameModal(true);
};

const handleSubmitPlaylistName = () => {
  if (!playlistName.trim()) return;
  setShowNameModal(false);
  const cardParams = displayedCards.map((c) => ({
    id: c.id,
    front: c.front,
    back: c.back,
    status: c.status,
    searchText: searchField === 'front' ? c.front : c.back,
  }));
  navigation.navigate('PlaylistProgress', {
    playlistName: playlistName.trim(),
    cards: cardParams,
  });
};
```

**Step 4: Add the "Playlist" button in the header row**

In the `headerRow` View (around line 74-84), add a button between the title and export button:

Change:
```typescript
<View style={styles.headerRow}>
  <Text style={styles.title}>{deckName}</Text>
  <TouchableOpacity
    style={styles.exportButton}
    onPress={() =>
      navigation.navigate('Export', { deckId, deckName })
    }
  >
    <Text style={styles.exportText}>Export</Text>
  </TouchableOpacity>
</View>
```

to:

```typescript
<View style={styles.headerRow}>
  <Text style={styles.title}>{deckName}</Text>
  <TouchableOpacity
    style={styles.playlistButton}
    onPress={handleCreatePlaylist}
  >
    <Text style={styles.playlistButtonText}>Playlist</Text>
  </TouchableOpacity>
  <TouchableOpacity
    style={styles.exportButton}
    onPress={() =>
      navigation.navigate('Export', { deckId, deckName })
    }
  >
    <Text style={styles.exportText}>Export</Text>
  </TouchableOpacity>
</View>
```

**Step 5: Add the confirmation and name modals**

Add just before the closing `</View>` of the component (before line 217):

```typescript
{/* Confirmation modal */}
<Modal visible={showPlaylistModal} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Create Playlist</Text>
      <Text style={styles.modalBody}>
        Create a Spotify playlist from {displayedCards.length} card
        {displayedCards.length !== 1 ? 's' : ''}?
      </Text>
      <Text style={styles.modalHint}>
        Adjust your filters to change which songs are included.
      </Text>
      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={styles.modalCancel}
          onPress={() => setShowPlaylistModal(false)}
        >
          <Text style={styles.modalCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modalConfirm}
          onPress={handleConfirmPlaylist}
        >
          <Text style={styles.modalConfirmText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>

{/* Playlist name modal */}
<Modal visible={showNameModal} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Playlist Name</Text>
      <TextInput
        style={styles.nameInput}
        value={playlistName}
        onChangeText={setPlaylistName}
        placeholder="Enter playlist name"
        placeholderTextColor="#666"
        autoFocus
        onSubmitEditing={handleSubmitPlaylistName}
        returnKeyType="done"
      />
      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={styles.modalCancel}
          onPress={() => setShowNameModal(false)}
        >
          <Text style={styles.modalCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modalConfirm}
          onPress={handleSubmitPlaylistName}
        >
          <Text style={styles.modalConfirmText}>Create</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
```

**Step 6: Add styles**

Add to the StyleSheet:

```typescript
playlistButton: {
  backgroundColor: '#1DB954',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 20,
  marginRight: 8,
},
playlistButtonText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 13,
},
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.7)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
},
modalContent: {
  backgroundColor: '#282828',
  borderRadius: 16,
  padding: 24,
  width: '100%',
  maxWidth: 340,
},
modalTitle: {
  color: '#fff',
  fontSize: 20,
  fontWeight: '700',
  marginBottom: 12,
},
modalBody: {
  color: '#b3b3b3',
  fontSize: 15,
  marginBottom: 8,
},
modalHint: {
  color: '#727272',
  fontSize: 13,
  marginBottom: 20,
  fontStyle: 'italic',
},
modalButtons: {
  flexDirection: 'row',
  gap: 10,
},
modalCancel: {
  flex: 1,
  padding: 12,
  borderRadius: 24,
  backgroundColor: '#535353',
  alignItems: 'center',
},
modalCancelText: {
  color: '#fff',
  fontWeight: '600',
},
modalConfirm: {
  flex: 1,
  padding: 12,
  borderRadius: 24,
  backgroundColor: '#1DB954',
  alignItems: 'center',
},
modalConfirmText: {
  color: '#fff',
  fontWeight: '700',
},
nameInput: {
  backgroundColor: '#1e1e1e',
  color: '#fff',
  fontSize: 16,
  padding: 14,
  borderRadius: 8,
  marginBottom: 20,
},
```

**Step 7: Verify it compiles**

Run: `npx tsc --noEmit`

---

### Task 5: Register PlaylistProgress screen in navigation

**Files:**
- Modify: `src/navigation/AppNavigator.tsx`

**Step 1: Add the import**

After the ExportScreen import (line 7):

```typescript
import PlaylistProgressScreen from '../screens/PlaylistProgressScreen';
```

**Step 2: Add the screen to the navigator**

After the Export screen definition (after line 54, before `</Stack.Navigator>`):

```typescript
<Stack.Screen
  name="PlaylistProgress"
  options={{ title: 'Creating Playlist', headerBackVisible: false }}
>
  {(props: any) => (
    <PlaylistProgressScreen {...props} accessToken={accessToken} />
  )}
</Stack.Screen>
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`

---

### Task 6: Manual testing

**Test scenarios:**

1. **All matched cards** — Filter to "Matched" on CardQueueScreen → tap Playlist → confirm → enter name → progress screen shows tracks resolving quickly (using existing URIs) → playlist created → Open in Spotify works

2. **Mix of matched and unmatched** — Filter to "All" → tap Playlist → confirm → enter name → progress screen shows resolving, matched cards resolve instantly, unmatched cards take a moment each → playlist created

3. **No cards** — Filter that yields 0 cards → tap Playlist → alert says "No cards"

4. **Cancel flows** — Tap Playlist → Cancel on confirmation modal. Tap Playlist → Continue → Cancel on name modal. Both should return to CardQueueScreen with no side effects.

5. **Auth scope** — Log out, log back in → should be prompted for the new playlist scope → playlist creation works after re-auth
