import { SPOTIFY_API_BASE } from '../config/spotify';
import { SpotifyTrack, PlaybackState } from '../types';

export function useSpotify(accessToken: string | null) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const searchTracks = async (
    query: string,
    limit: number = 10
  ): Promise<SpotifyTrack[]> => {
    if (!accessToken) return [];
    try {
      const res = await fetch(
        `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
        { headers }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.tracks?.items ?? [];
    } catch {
      return [];
    }
  };

  const getPlaybackState = async (): Promise<PlaybackState | null> => {
    if (!accessToken) return null;
    try {
      const res = await fetch(`${SPOTIFY_API_BASE}/me/player`, { headers });
      if (res.status === 204 || !res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  };

  const seekToPosition = async (positionMs: number): Promise<boolean> => {
    if (!accessToken) return false;
    try {
      const res = await fetch(
        `${SPOTIFY_API_BASE}/me/player/seek?position_ms=${positionMs}`,
        { method: 'PUT', headers }
      );
      return res.ok;
    } catch {
      return false;
    }
  };

  const playTrack = async (
    spotifyUri: string,
    positionMs: number
  ): Promise<boolean> => {
    if (!accessToken) return false;
    try {
      const res = await fetch(`${SPOTIFY_API_BASE}/me/player/play`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ uris: [spotifyUri], position_ms: positionMs }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  return { searchTracks, getPlaybackState, seekToPosition, playTrack };
}
