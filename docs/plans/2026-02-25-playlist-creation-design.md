# Playlist Creation Design

## Problem

Users have matched cards to songs (or want auto-matched results) but have no way to create a Spotify playlist from their deck. They must manually find each song in Spotify.

## Approach

Single linear flow: header button → confirmation modal → playlist name form → progress screen → deep link to Spotify.

## Auth Changes

Add `playlist-modify-public` to `SPOTIFY_SCOPES`. Users must re-authenticate to grant the new scope.

## Spotify API Methods

Add to `useSpotify` hook:

- **`getCurrentUser()`** — `GET /me` → returns `{ id }` needed for playlist creation
- **`createPlaylist(userId, name)`** — `POST /users/{userId}/playlists` → returns playlist object
- **`addTracksToPlaylist(playlistId, uris[])`** — `POST /playlists/{playlistId}/tracks`, batched at 100 per request

All methods retry on 429 with exponential backoff using `Retry-After` header.

## Flow

1. **CardQueueScreen** — "Create Playlist" button in header (top-right). Opens confirmation modal: "Create a playlist from N cards? Adjust your filters to change which songs are included." Shows matched/unmatched count.
2. **PlaylistNameScreen** — Text input pre-filled with deck name + "Create" button.
3. **PlaylistProgressScreen** — Resolves tracks:
   - Matched cards: use existing `spotify_uri` (no API call)
   - Unmatched cards: `searchTracks(searchField)`, take top result
   - Live progress: "Resolving tracks... 23/50"
4. Creates playlist, batch-adds tracks. Progress: "Creating playlist..." → "Adding tracks..."
5. Done state: success message + "Open in Spotify" button via `Linking.openURL(playlist.uri)`.

## Navigation

Add two screens to the stack:
- **PlaylistName** — name form
- **PlaylistProgress** — progress display + completion state

## Data Flow

Filtered card list from CardQueueScreen passed via navigation params. Each card carries: `id`, `front`, `back`, `status`, and for matched cards the existing track info from `getTrackForCard()`.

## Error Handling

- **Rate limit (429):** retry with `Retry-After` header, exponential backoff
- **Search failures:** skip card, show skipped count at end
- **Playlist creation failure:** error alert with retry
- **No tracks resolved:** message shown, no playlist created
