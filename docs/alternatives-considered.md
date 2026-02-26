# Alternatives Originally Considered

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

**Confidence scoring and auto-ranking**
Right now search results are shown in Spotify's default relevance order. A scoring layer that ranks candidates by how likely they are to actually contain the card's phrase (based on title/artist match, genre, etc.) would reduce manual browsing. Or if users want to score by artist popularity or song listens to maximize enjoyment, this could also be useful.
**Updated:** Spotify removed popularity info from API, relevance likely already included in search.
