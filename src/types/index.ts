export interface AnkiCard {
  id: number;
  deckId: number;
  front: string;
  back: string;
  tags: string;
  status: 'pending' | 'matched' | 'skipped';
}

export interface Deck {
  id: number;
  name: string;
  importedAt: string;
  cardCount: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  uri: string;
  external_urls: { spotify: string };
  duration_ms: number;
}

export interface Timestamp {
  id: number;
  cardId: number;
  trackId: string;
  trackName: string;
  artistName: string;
  albumArt: string;
  spotifyUrl: string;
  spotifyUri: string;
  progressMs: number;
  note: string;
  captureMode: 'auto' | 'manual';
  capturedAt: string;
}

export interface PlaybackState {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
}
