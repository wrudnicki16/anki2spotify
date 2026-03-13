# Search Current Track Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Now Playing" search feature that finds cards matching the currently playing Spotify track, accessible from both the home screen and within individual decks.

**Architecture:** New `TrackSearchResultsScreen` fed by two new database queries (`getCardsByTrackId` for exact timestamp matches, `searchCardsByText` for fuzzy fallback). Two entry-point buttons added to existing screens. Standard stack navigation — no new patterns.

**Tech Stack:** React Native, expo-sqlite, Spotify Web API (`GET /me/player`), existing `useSpotify` hook

---

### Task 1: Add database queries

**Files:**
- Modify: `src/db/database.ts` (after line 305, before file end)
- Modify: `src/types/index.ts` (add new result type)

**Step 1: Add `CardWithDeck` type to `src/types/index.ts`**

Add after the `ExportRow` interface (line 103):

```typescript
export interface CardWithDeck {
  card_id: number;
  front: string;
  back: string;
  status: string;
  deck_id: number;
  deck_name: string;
  clip_count: number;
}
```

**Step 2: Add `getCardsByTrackId` to `src/db/database.ts`**

Add at end of file:

```typescript
export async function getCardsByTrackId(trackId: string): Promise<CardWithDeck[]> {
  const database = await getDatabase();
  return database.getAllAsync(
    `SELECT c.id as card_id, c.front, c.back, c.status,
            d.id as deck_id, d.name as deck_name,
            COUNT(t.id) as clip_count
     FROM timestamps t
     JOIN cards c ON c.id = t.card_id
     JOIN decks d ON d.id = c.deck_id
     WHERE t.track_id = ?
     GROUP BY c.id
     ORDER BY clip_count DESC`,
    trackId
  ) as CardWithDeck[];
}
```

Add the import for `CardWithDeck` at top of `database.ts`.

**Step 3: Add `searchCardsByText` to `src/db/database.ts`**

Add at end of file:

```typescript
export async function searchCardsByText(query: string): Promise<CardWithDeck[]> {
  const database = await getDatabase();
  const pattern = `%${query}%`;
  return database.getAllAsync(
    `SELECT c.id as card_id, c.front, c.back, c.status,
            d.id as deck_id, d.name as deck_name,
            COALESCE(tc.clip_count, 0) as clip_count
     FROM cards c
     JOIN decks d ON d.id = c.deck_id
     LEFT JOIN (
       SELECT card_id, COUNT(*) as clip_count
       FROM timestamps GROUP BY card_id
     ) tc ON tc.card_id = c.id
     WHERE c.front LIKE ? OR c.back LIKE ?
     ORDER BY clip_count DESC, c.id`,
    [pattern, pattern]
  ) as CardWithDeck[];
}
```

**Step 4: Commit**

```bash
git add src/db/database.ts src/types/index.ts
git commit -m "feat: add getCardsByTrackId and searchCardsByText queries"
```

---

### Task 2: Create TrackSearchResultsScreen

**Files:**
- Create: `src/screens/TrackSearchResultsScreen.tsx`

**Step 1: Create the screen file**

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSpotify } from '../hooks/useSpotify';
import { getCardsByTrackId, searchCardsByText } from '../db/database';
import { colors } from '../constants/colors';
import { CardWithDeck, SpotifyTrack, TrackParam } from '../types';

interface Props {
  route: any;
  navigation: any;
  accessToken: string | null;
}

export default function TrackSearchResultsScreen({
  route,
  navigation,
  accessToken,
}: Props) {
  const { deckId } = (route.params ?? {}) as { deckId?: number };
  const { getPlaybackState } = useSpotify(accessToken);

  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [results, setResults] = useState<CardWithDeck[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentTrack();
  }, []);

  const fetchCurrentTrack = async () => {
    setLoading(true);
    setError(null);
    const state = await getPlaybackState();
    if (!state?.item) {
      setCurrentTrack(null);
      setLoading(false);
      setError('No track currently playing');
      return;
    }
    setCurrentTrack(state.item);
    await searchByTrackId(state.item);
  };

  const searchByTrackId = async (track: SpotifyTrack) => {
    const matches = await getCardsByTrackId(track.id);
    if (matches.length > 0) {
      setResults(sortResults(matches));
      setShowFallback(false);
    } else {
      const trackName = track.name;
      setSearchQuery(trackName);
      setShowFallback(true);
      await runTextSearch(trackName);
    }
    setLoading(false);
  };

  const runTextSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const matches = await searchCardsByText(query.trim());
    setResults(sortResults(matches));
  };

  const sortResults = (cards: CardWithDeck[]): CardWithDeck[] => {
    if (deckId == null) return cards;
    return [...cards].sort((a, b) => {
      if (a.deck_id === deckId && b.deck_id !== deckId) return -1;
      if (b.deck_id === deckId && a.deck_id !== deckId) return 1;
      return 0;
    });
  };

  const handleSubmitSearch = () => {
    runTextSearch(searchQuery);
  };

  const buildTrackParam = (track: SpotifyTrack): TrackParam => ({
    id: track.id,
    name: track.name,
    artists: track.artists.map((a) => a.name).join(', '),
    albumArt: track.album.images?.[0]?.url ?? '',
    spotifyUrl: track.external_urls.spotify,
    spotifyUri: track.uri,
    durationMs: track.duration_ms,
  });

  const handleSelectCard = (card: CardWithDeck) => {
    if (!currentTrack) return;
    navigation.navigate('Capture', {
      cardId: card.card_id,
      cardFront: card.front,
      cardBack: card.back,
      track: buildTrackParam(currentTrack),
    });
  };

  const artistText = currentTrack
    ? currentTrack.artists.map((a) => a.name).join(', ')
    : '';
  const albumArt = currentTrack?.album.images?.[0]?.url ?? '';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.spotifyGreen} />
        <Text style={styles.loadingText}>Checking playback...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          style={styles.retryButton}
          onPress={fetchCurrentTrack}
          accessibilityLabel="Retry"
          accessibilityRole="button"
          testID="retry-btn"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Current track header */}
      <View style={styles.trackHeader}>
        {albumArt ? (
          <Image source={{ uri: albumArt }} style={styles.albumArt} />
        ) : null}
        <View style={styles.trackInfo}>
          <Text style={styles.trackName} numberOfLines={2}>
            {currentTrack?.name}
          </Text>
          <Text style={styles.artistName}>{artistText}</Text>
        </View>
      </View>

      {/* Fallback search input */}
      {showFallback && (
        <>
          <Text style={styles.fallbackMessage}>
            No saved matches for this track
          </Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSubmitSearch}
            placeholder="Search cards..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            testID="search-input"
          />
        </>
      )}

      {/* Results */}
      {results.length === 0 ? (
        <Text style={styles.noResults}>No matching cards found</Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.card_id.toString()}
          renderItem={({ item }) => (
            <Pressable
              style={styles.cardItem}
              onPress={() => handleSelectCard(item)}
              accessibilityRole="button"
              testID="result-card"
            >
              <View style={styles.cardContent}>
                <Text style={styles.cardFront} numberOfLines={1}>
                  {item.front}
                </Text>
                <Text style={styles.cardBack} numberOfLines={1}>
                  {item.back}
                </Text>
                <Text style={styles.deckLabel}>{item.deck_name}</Text>
              </View>
              {item.clip_count > 0 && (
                <View style={styles.clipBadge}>
                  <Text style={styles.clipBadgeText}>
                    {item.clip_count} clip{item.clip_count !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.spotifyGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  trackHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  albumArt: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  trackName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  artistName: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  fallbackMessage: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  noResults: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  cardItem: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardFront: {
    color: colors.spotifyGreen,
    fontSize: 15,
    fontWeight: '600',
  },
  cardBack: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  deckLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  clipBadge: {
    backgroundColor: colors.spotifyGreenTransparent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  clipBadgeText: {
    color: colors.spotifyGreen,
    fontSize: 11,
    fontWeight: '600',
  },
});
```

**Step 2: Commit**

```bash
git add src/screens/TrackSearchResultsScreen.tsx
git commit -m "feat: add TrackSearchResultsScreen"
```

---

### Task 3: Register screen in navigator

**Files:**
- Modify: `src/navigation/AppNavigator.tsx`

**Step 1: Add import**

Add after the PlaylistProgressScreen import (line 8):

```typescript
import TrackSearchResultsScreen from '../screens/TrackSearchResultsScreen';
```

**Step 2: Add screen to Stack.Navigator**

Add after the PlaylistProgress screen block (after line 62), before `</Stack.Navigator>`:

```typescript
      <Stack.Screen
        name="TrackSearchResults"
        options={{ title: 'Now Playing' }}
      >
        {(props: any) => (
          <TrackSearchResultsScreen {...props} accessToken={accessToken} />
        )}
      </Stack.Screen>
```

**Step 3: Commit**

```bash
git add src/navigation/AppNavigator.tsx
git commit -m "feat: register TrackSearchResults in navigator"
```

---

### Task 4: Add "Now Playing" button to DeckImportScreen

**Files:**
- Modify: `src/screens/DeckImportScreen.tsx`

**Step 1: Add the button**

The DeckImportScreen doesn't have access to `accessToken`. Since the auth bar in `App.tsx` is rendered outside the navigator, the simplest approach is to add the button inside the DeckImportScreen and always show it — the TrackSearchResultsScreen will handle the "no auth" case by showing an error when `getPlaybackState()` fails.

In `DeckImportScreen.tsx`, find the header section (line 188):

```typescript
<Text style={styles.header}>Anki2Spotify</Text>
```

Replace with:

```typescript
      <View style={styles.titleRow}>
        <Text style={styles.header}>Anki2Spotify</Text>
        <Pressable
          style={styles.nowPlayingButton}
          onPress={() => navigation.navigate('TrackSearchResults')}
          accessibilityLabel="Search Now Playing"
          accessibilityRole="button"
          testID="now-playing-btn"
        >
          <Text style={styles.nowPlayingText}>Now Playing</Text>
        </Pressable>
      </View>
```

**Step 2: Add styles**

Add to the StyleSheet after the `header` style (after line 354):

```typescript
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  nowPlayingButton: {
    backgroundColor: colors.spotifyGreen,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  nowPlayingText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
```

Update the `header` style to remove `marginBottom` and `marginTop` since the `titleRow` now handles spacing:

```typescript
  header: {
    color: colors.spotifyGreen,
    fontSize: 28,
    fontWeight: '800',
  },
```

**Step 3: Commit**

```bash
git add src/screens/DeckImportScreen.tsx
git commit -m "feat: add Now Playing button to DeckImportScreen"
```

---

### Task 5: Add "Now Playing" button to CardQueueScreen

**Files:**
- Modify: `src/screens/CardQueueScreen.tsx`

**Step 1: Add the button**

In `CardQueueScreen.tsx`, find the `headerRow` section (lines 124-155). Add a "Now Playing" button. Insert after the title `<Text>` (line 125) and before the Playlist button (line 126):

```typescript
        <Pressable
          style={styles.nowPlayingButton}
          onPress={() =>
            navigation.navigate('TrackSearchResults', { deckId })
          }
          accessibilityLabel="Search Now Playing"
          accessibilityRole="button"
          testID="now-playing-btn"
        >
          <Text style={styles.nowPlayingText}>NP</Text>
        </Pressable>
```

Note: Using "NP" as the label since the header row is already crowded with Playlist, Match Cards, and Export buttons. This keeps it compact.

**Step 2: Add styles**

Add to StyleSheet:

```typescript
  nowPlayingButton: {
    backgroundColor: colors.spotifyGreen,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  nowPlayingText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
```

**Step 3: Commit**

```bash
git add src/screens/CardQueueScreen.tsx
git commit -m "feat: add Now Playing button to CardQueueScreen"
```

---

### Task 6: Manual smoke test

**Step 1: Start the dev server**

```bash
npx expo start
```

**Step 2: Test the full flow**

1. Open the app in Expo Go
2. Connect Spotify
3. Start playing a song in Spotify
4. Tap "Now Playing" on home screen → should show current track + search results
5. If no timestamp matches, should show fallback search with track name pre-filled
6. Edit search query, hit enter → should show matching cards
7. Tap a card → should navigate to CaptureScreen
8. Go back, navigate into a deck, tap "NP" → same behavior but current deck results sorted first
9. Test with no song playing → should show "No track currently playing" + retry
10. Test retry button → should re-fetch playback state

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during smoke test"
```

---

### Task 7: Final commit and cleanup

**Step 1: Run existing tests to ensure nothing is broken**

```bash
npm test
```

Expected: All existing tests pass.

**Step 2: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup after search-current-track feature"
```
