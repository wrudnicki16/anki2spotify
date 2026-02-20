# Anki2Spotify

A React Native (Expo) app that bridges your Anki flashcard decks with Spotify. Import a deck, find songs that match each card's content, and save precise timestamps for where that word or phrase appears in the music. Works for both Free and Premium Spotify users.

---

## Origin

The idea started from a simple question: *can I make an app that takes a flashcard deck like Anki and searches for songs that match the back of the card — whether it's a word or phrase — and submit the time in minutes/seconds of where it occurs?*

The answer is yes, with some intentional tradeoffs:

- **No lyrics in v1.** Spotify's public API doesn't expose lyrics or lyric timestamps (those are licensed from Musixmatch and not available to third-party apps). Rather than fight that constraint, the app trusts the user to listen and tap "Mark Timestamp" when they hear the match.
- **Free + Premium.** Spotify's playback-control endpoints are Premium-only. The app reads playback state when available (auto-capture) and falls back to manual `mm:ss` entry when it isn't — so Free users are never blocked.
- **Deep-linking to the exact time.** Spotify track URIs don't support `t=` parameters for songs (only podcast episodes do). The workaround: for Premium users with an active device, the app calls the Spotify Seek API to jump directly to the saved timestamp. For everyone else, the timestamp is displayed prominently so the user can scrub manually.

---

## Features

### Deck Management
- Import Anki decks exported as CSV (tab- or comma-separated, with or without a header row, strips `#` metadata directives)
- Preview up to 20 cards before confirming import
- View all decks on the home screen with card counts
- Long-press a deck to delete it (cascades to cards and timestamps)

### Card Queue
- Browse all cards for a deck; filter by status: **All / Pending / Matched / Skipped**
- Toggle the Spotify search term between the card **Front** and **Back** (persisted per deck)
- "Lyrics only" filter hides cards whose search field is fewer than 3 words
  * Spotify returns only song titles, artists, and album matches for 1-2 words
- Tapping a **matched** card skips the search screen and goes directly to the Capture screen showing the previously saved track
- Tapping a **pending** card opens the Song Candidates search

### Song Search
- Spotify track search auto-runs on arrival using the card's search field
- Editable query — tweak and re-run without leaving the screen
- Results show album art, track name, and artist

### Timestamp Capture
- **Auto-capture:** reads Spotify's current playback state and records `progress_ms` in one tap
- **Manual entry:** `mm:ss` picker always available as a fallback
- **Jump (Premium):** calls Spotify's seek endpoint to start playback at the exact saved timestamp
- **Open in Spotify:** deep-links to the track via `spotify:track:` URI with HTTPS fallback
- **Copy timestamp:** copies `m:ss` to clipboard
- Multiple clips can be saved per card (useful for multiple occurrences of a phrase)
- Delete individual clips
- "Search for different track" link navigates back to Song Candidates without losing context

### Export
- Per-deck CSV export: `Front, Back, Track, Artist, Timestamp, Note, Mode, Spotify URL, Captured At`
- Shared via the native share sheet (or path shown if sharing is unavailable)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Expo (managed workflow), TypeScript |
| Navigation | `@react-navigation/native-stack` |
| Database | `expo-sqlite` (WAL mode) |
| File I/O | `expo-document-picker`, `expo-file-system` |
| Sharing | `expo-sharing` |
| Auth | `expo-web-browser` — Authorization Code + PKCE flow |
| Spotify API | Web API — search, playback state, seek, play |
| Clipboard | `expo-clipboard` |

---

## Data Model

```
decks
  id, name, imported_at, search_field ('front' | 'back')

cards
  id, deck_id → decks, front, back, tags, status ('pending' | 'matched' | 'skipped')

timestamps
  id, card_id → cards
  track_id, track_name, artist_name, album_art, spotify_url, spotify_uri
  progress_ms, note, capture_mode ('auto' | 'manual'), captured_at
```

---

## Screen Flow

```
DeckImportScreen
  └── CardQueueScreen
        ├── SongCandidatesScreen  (pending cards, or "Search for different track")
        │     └── CaptureScreen
        └── CaptureScreen         (matched cards — skips search)

CardQueueScreen
  └── ExportScreen
```

---

## Spotify Auth

- Authorization Code + PKCE (implicit flow deprecated by Spotify)
- Redirect URI: `makeRedirectUri()` with no path — matches `exp://...exp.direct` registered in the Spotify Developer Dashboard
- Scopes used: `user-read-playback-state`, `user-modify-playback-state`
- `WebBrowser.openAuthSessionAsync` with `showInRecents: false` so the browser auto-closes after redirect

---

## What Could Come Next

The original design conversation covered several ideas that aren't yet built. Here's what was discussed and the current status:

### Must have

**APKG import**
Anki's native `.apkg` format is a zipped SQLite database + media. Currently only CSV export is supported. APKG support would make the import flow much smoother for most Anki users.

---

### Actively being considered

**Playlist / queue builder**
Generate a Spotify playlist from all the matched tracks for a deck — so you could review a whole deck's worth of songs in one listening session. Likely requires working around Spotify's rate-limited API.

**Review mode**
A "Play next match → one-tap capture" flow that steps through unmatched cards sequentially, making bulk capture faster. Convenience feature.

**Confidence scoring and auto-ranking**
Right now search results are shown in Spotify's default relevance order. A scoring layer that ranks candidates by how likely they are to actually contain the card's phrase (based on title/artist match, genre, etc.) would reduce manual browsing. Or if users want to score by artist popularity or song listens to maximize enjoyment, this could also be useful. Unsure how much we can get from Spotify's API here.

---

### Alternatives considered in the original conversation

**Lyric matching / display**
The conversation explicitly deferred lyrics to v2. When added, the cleanest options are:
1. A licensed lyrics provider that exposes full text via API
2. User-pasted lyrics (no licensing risk)
3. Audio transcription + forced alignment on a backend (most powerful — see below)

**Automatic timestamp detection via forced alignment**
The most technically interesting path: supply audio + lyrics text, run forced alignment (e.g. Montreal Forced Aligner) server-side, and get word-level timestamps back. Currently the app is entirely client-side; this would require a backend.

**YouTube as an alternate source**
YouTube was discussed as an alternative to Spotify because its `t=` parameter makes true deep-link-to-timestamp easy for any user, and auto-captions give a text source to match against. No YouTube integration is currently built.

**Genius integration (metadata only)**
Genius was discussed as a useful canonical song index — better at resolving alternate titles, features, and remixes than Spotify search alone. The public Genius API does not return full lyrics cleanly (scraping their HTML is against their ToS), so the intended use would be: Genius search to identify the correct song, then hand off to Spotify for the actual playback workflow.

**Re-import to Anki**
The exported CSV maps directly back to Anki's import format, but a dedicated "Anki-ready export" mode with the timestamp formatted as a note field would make the round-trip seamless.
