# Clip-Per-Song Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scope clips to their specific song so CaptureScreen only shows clips for the current track, and SongCandidatesScreen surfaces which songs already have clips.

**Architecture:** No schema changes. Add two new DB queries, update CaptureScreen to filter by track, update SongCandidatesScreen to partition results by prior matches.

**Tech Stack:** React Native, expo-sqlite, TypeScript

---

### Task 1: Add `getTimestampsForCardAndTrack` query

**Files:**
- Modify: `src/db/database.ts:185-191`

**Step 1: Add the new query function**

Add after the existing `getTimestampsByCard` function (line 191):

```typescript
export async function getTimestampsForCardAndTrack(
  cardId: number,
  trackId: string
): Promise<any[]> {
  const database = await getDatabase();
  return database.getAllAsync(
    'SELECT * FROM timestamps WHERE card_id = ? AND track_id = ? ORDER BY captured_at DESC',
    [cardId, trackId]
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to database.ts

---

### Task 2: Add `getTracksWithClipsForCard` query

**Files:**
- Modify: `src/db/database.ts` (after the function added in Task 1)

**Step 1: Add the query function**

```typescript
export async function getTracksWithClipsForCard(
  cardId: number
): Promise<
  {
    track_id: string;
    track_name: string;
    artist_name: string;
    album_art: string;
    spotify_url: string;
    spotify_uri: string;
    clip_count: number;
  }[]
> {
  const database = await getDatabase();
  return database.getAllAsync(
    `SELECT track_id, track_name, artist_name, album_art, spotify_url, spotify_uri, COUNT(*) as clip_count
     FROM timestamps
     WHERE card_id = ?
     GROUP BY track_id
     ORDER BY MAX(captured_at) DESC`,
    cardId
  ) as any;
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to database.ts

---

### Task 3: Update CaptureScreen to filter clips by track

**Files:**
- Modify: `src/screens/CaptureScreen.tsx:14-19` (imports)
- Modify: `src/screens/CaptureScreen.tsx:75-78` (loadTimestamps)

**Step 1: Update import**

In the import block at line 16, change:

```typescript
import {
  insertTimestamp,
  getTimestampsByCard,
  deleteTimestamp,
  updateCardStatus,
} from '../db/database';
```

to:

```typescript
import {
  insertTimestamp,
  getTimestampsForCardAndTrack,
  deleteTimestamp,
  updateCardStatus,
} from '../db/database';
```

**Step 2: Update loadTimestamps function**

Change the `loadTimestamps` function (line 75-78) from:

```typescript
const loadTimestamps = async () => {
  const ts = await getTimestampsByCard(cardId);
  setTimestamps(ts as TimestampRow[]);
};
```

to:

```typescript
const loadTimestamps = async () => {
  const ts = await getTimestampsForCardAndTrack(cardId, track.id);
  setTimestamps(ts as TimestampRow[]);
};
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to CaptureScreen.tsx

---

### Task 4: Update SongCandidatesScreen to show previous matches

**Files:**
- Modify: `src/screens/SongCandidatesScreen.tsx`
- Modify: `src/components/TrackCard.tsx`

**Step 1: Add clipCount prop to TrackCard**

In `src/components/TrackCard.tsx`, update the Props interface and render a badge when clipCount is provided:

Change the Props interface (line 13-16):

```typescript
interface Props {
  track: SpotifyTrack;
  onSelect?: (track: SpotifyTrack) => void;
  clipCount?: number;
}
```

Update the component signature (line 17):

```typescript
export default function TrackCard({ track, onSelect, clipCount }: Props) {
```

Add a clip badge after the info section (between the `</View>` closing `info` and `<View style={styles.actions}>`):

```typescript
{clipCount != null && clipCount > 0 && (
  <View style={styles.clipBadge}>
    <Text style={styles.clipBadgeText}>
      {clipCount} clip{clipCount !== 1 ? 's' : ''} saved
    </Text>
  </View>
)}
```

Add these styles to the StyleSheet:

```typescript
clipBadge: {
  backgroundColor: '#1DB95433',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 12,
  alignSelf: 'flex-start',
  marginBottom: 8,
},
clipBadgeText: {
  color: '#1DB954',
  fontSize: 12,
  fontWeight: '600',
},
```

**Step 2: Update SongCandidatesScreen to partition results**

In `src/screens/SongCandidatesScreen.tsx`:

Add the database import at the top:

```typescript
import { getTracksWithClipsForCard } from '../db/database';
```

Add state for tracks with existing clips (after the `searched` state on line 32):

```typescript
const [tracksWithClips, setTracksWithClips] = useState<Map<string, number>>(new Map());
```

Add a useEffect to load existing clips on mount (after the existing useEffect on line 34-38):

```typescript
useEffect(() => {
  getTracksWithClipsForCard(cardId).then((rows) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.track_id, row.clip_count);
    }
    setTracksWithClips(map);
  });
}, [cardId]);
```

Replace the FlatList `data` and `renderItem` (lines 107-114). Change:

```typescript
<FlatList
  data={results}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    <TrackCard track={item} onSelect={handleSelect} />
  )}
  contentContainerStyle={{ paddingBottom: 20 }}
/>
```

to:

```typescript
<FlatList
  data={[...results].sort((a, b) => {
    const aClips = tracksWithClips.get(a.id) ?? 0;
    const bClips = tracksWithClips.get(b.id) ?? 0;
    if (aClips > 0 && bClips === 0) return -1;
    if (aClips === 0 && bClips > 0) return 1;
    return 0;
  })}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    <TrackCard
      track={item}
      onSelect={handleSelect}
      clipCount={tracksWithClips.get(item.id)}
    />
  )}
  contentContainerStyle={{ paddingBottom: 20 }}
/>
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

### Task 5: Manual testing

**Test scenarios:**

1. **New card, no clips** — Tap a pending card → SongCandidatesScreen shows results without any badges → Select a song → CaptureScreen shows no saved clips → Save a clip → Clip appears in list

2. **Matched card, fast path** — Tap a matched card → Goes straight to CaptureScreen with the most recent song → Shows only clips for that song

3. **Multiple songs, same card** — From CaptureScreen, tap "Search for different track" → SongCandidatesScreen shows the first song sorted to top with "1 clip saved" badge → Select a different song → CaptureScreen shows no clips (new song) → Save a clip → Go back to SongCandidatesScreen → Both songs now show badges

4. **Export still works** — Go to export screen → All clips from all songs are included in the CSV
