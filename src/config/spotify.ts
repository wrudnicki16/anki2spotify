import * as Linking from 'expo-linking';

export const SPOTIFY_CLIENT_ID = 'dfbe7a1948124b9081d3972dd4f8a385';

export const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state',
  'playlist-modify-public',
  'playlist-modify-private',
];

export const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export const getRedirectUri = () => {
  return Linking.createURL('callback');
};
