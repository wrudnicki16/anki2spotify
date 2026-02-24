import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { SpotifyTrack } from '../types';

interface Props {
  track: SpotifyTrack;
  onSelect?: (track: SpotifyTrack) => void;
  clipCount?: number;
}

export default function TrackCard({ track, onSelect, clipCount }: Props) {
  const albumArt = track.album.images[1]?.url ?? track.album.images[0]?.url;
  const artists = track.artists.map((a) => a.name).join(', ');

  const openInSpotify = async () => {
    try {
      const supported = await Linking.canOpenURL(track.uri);
      if (supported) {
        await Linking.openURL(track.uri);
      } else {
        await Linking.openURL(track.external_urls.spotify);
      }
    } catch {
      await Linking.openURL(track.external_urls.spotify);
    }
  };

  return (
    <View style={styles.container}>
      {albumArt && (
        <Image source={{ uri: albumArt }} style={styles.albumArt} />
      )}
      <View style={styles.info}>
        <Text style={styles.trackName} numberOfLines={1}>
          {track.name}
        </Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {artists}
        </Text>
        <Text style={styles.albumName} numberOfLines={1}>
          {track.album.name}
        </Text>
      </View>
      {clipCount != null && clipCount > 0 && (
        <View style={styles.clipBadge}>
          <Text style={styles.clipBadgeText}>
            {clipCount} clip{clipCount !== 1 ? 's' : ''} saved
          </Text>
        </View>
      )}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.openButton} onPress={openInSpotify}>
          <Text style={styles.openButtonText}>Open</Text>
        </TouchableOpacity>
        {onSelect && (
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => onSelect(track)}
          >
            <Text style={styles.selectButtonText}>Select</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.attribution}>
        Content provided by Spotify. Tap Open to listen on Spotify.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  albumArt: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
  },
  info: {
    marginBottom: 10,
  },
  trackName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  artistName: {
    color: '#b3b3b3',
    fontSize: 14,
    marginTop: 2,
  },
  albumName: {
    color: '#727272',
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  openButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flex: 1,
    alignItems: 'center',
  },
  openButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  selectButton: {
    backgroundColor: '#535353',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flex: 1,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
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
  attribution: {
    color: '#535353',
    fontSize: 10,
    textAlign: 'center',
  },
});
