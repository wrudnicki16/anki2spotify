# Clip-Per-Song Design

## Problem

Clips (timestamps) are currently displayed per card regardless of which song they belong to. When a user saves clips across multiple songs for the same card, all clips are shown together on CaptureScreen with no way to distinguish which belong to which song. Song search results also don't indicate whether a song already has clips saved.

## Approach

No schema changes. The existing `timestamps` table already stores `card_id` and `track_id` per row. The fix is purely query and UI changes.

## Data Layer

New queries in `database.ts`:

- **`getTimestampsForCardAndTrack(cardId, trackId)`** — returns clips filtered to a specific card+song combo. Used by CaptureScreen.
- **`getTracksWithClipsForCard(cardId)`** — returns distinct tracks with clips for a card (track_id, track_name, artist_name, album_art, clip count). Used by SongCandidatesScreen.

Existing query unchanged:

- **`getTrackForCard(cardId)`** — returns most recent timestamp. Used by CardQueueScreen for fast-path navigation.

## UI Changes

### SongCandidatesScreen

1. On mount, fetch tracks with existing clips via `getTracksWithClipsForCard(cardId)`.
2. After Spotify search results arrive, partition into two groups:
   - **Previous matches** — tracks in search results that already have clips. Sorted to top with a label (e.g., "2 clips saved") and visual indicator.
   - **Search results** — remaining tracks, displayed as today.
3. Deduplicate: a track with clips that also appears in search results shows only in "Previous matches".

### CaptureScreen

- Load clips with `getTimestampsForCardAndTrack(cardId, trackId)` instead of all clips for the card.
- Save, delete, jump, copy all scoped to current song's clips only.

### CardQueueScreen

No changes. Tapping a matched card loads the most recent timestamp and navigates to CaptureScreen with that song.

### ExportScreen

No changes. `getTimestampsByDeck()` already exports all clips with track info per row.

## UX Flow

1. User taps a pending card → SongCandidatesScreen → search results shown, previous matches (if any) sorted to top
2. User picks a song → CaptureScreen → sees only clips for that song
3. User taps a matched card → CaptureScreen with most recent song (fast path preserved)
4. User wants a different song → goes back to SongCandidatesScreen → sees which songs already have clips
