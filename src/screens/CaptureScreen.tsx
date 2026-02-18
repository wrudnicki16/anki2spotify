import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { useSpotify } from '../hooks/useSpotify';
import TimestampPicker from '../components/TimestampPicker';
import {
  insertTimestamp,
  getTimestampsByCard,
  deleteTimestamp,
  updateCardStatus,
} from '../db/database';
import * as Clipboard from 'expo-clipboard';

interface TrackParam {
  id: string;
  name: string;
  artists: string;
  albumArt: string;
  spotifyUrl: string;
  spotifyUri: string;
  durationMs: number;
}

interface TimestampRow {
  id: number;
  progress_ms: number;
  note: string;
  capture_mode: string;
  captured_at: string;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  route: any;
  navigation: any;
  accessToken: string | null;
}

export default function CaptureScreen({
  route,
  navigation,
  accessToken,
}: Props) {
  const { cardId, cardFront, cardBack, track, searchField } = route.params as {
    cardId: number;
    cardFront: string;
    cardBack: string;
    track: TrackParam;
    searchField?: string;
  };

  const { getPlaybackState, playTrack } = useSpotify(accessToken);
  const [timestamps, setTimestamps] = useState<TimestampRow[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string>('');

  useEffect(() => {
    loadTimestamps();
  }, []);

  const loadTimestamps = async () => {
    const ts = await getTimestampsByCard(cardId);
    setTimestamps(ts as TimestampRow[]);
  };

  const handleAutoCapture = async () => {
    setAutoStatus('Reading playback...');
    const state = await getPlaybackState();

    if (state?.item && state.progress_ms !== undefined) {
      // Auto-capture succeeded
      const isMatchingTrack = state.item.id === track.id;
      await saveTimestamp(
        state.progress_ms,
        isMatchingTrack ? '' : `Playing: ${state.item.name}`,
        'auto'
      );
      setAutoStatus('');
    } else {
      // Fall back to manual
      setAutoStatus('No active playback detected. Use manual entry.');
      setShowManual(true);
    }
  };

  const saveTimestamp = async (
    ms: number,
    note: string,
    mode: 'auto' | 'manual'
  ) => {
    await insertTimestamp({
      cardId,
      trackId: track.id,
      trackName: track.name,
      artistName: track.artists,
      albumArt: track.albumArt,
      spotifyUrl: track.spotifyUrl,
      spotifyUri: track.spotifyUri,
      progressMs: ms,
      note,
      captureMode: mode,
    });
    await updateCardStatus(cardId, 'matched');
    await loadTimestamps();
    setShowManual(false);
    setAutoStatus('');
  };

  const handleManualSubmit = async (ms: number, note: string) => {
    await saveTimestamp(ms, note, 'manual');
  };

  const openInSpotify = async () => {
    try {
      const supported = await Linking.canOpenURL(track.spotifyUri);
      if (supported) {
        await Linking.openURL(track.spotifyUri);
      } else {
        await Linking.openURL(track.spotifyUrl);
      }
    } catch {
      await Linking.openURL(track.spotifyUrl);
    }
  };

  const copyTimestamp = async (ms: number) => {
    const formatted = formatMs(ms);
    if (Clipboard && Clipboard.setStringAsync) {
      await Clipboard.setStringAsync(formatted);
    }
    Alert.alert('Copied', `Timestamp ${formatted} copied to clipboard`);
  };

  const handleJump = async (ms: number) => {
    const success = await playTrack(track.spotifyUri, ms);
    if (!success) {
      Alert.alert(
        'Cannot Jump',
        'Playback requires Spotify Premium and an active device. Scrub manually to ' +
          formatMs(ms)
      );
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete', 'Remove this timestamp?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTimestamp(id);
          await loadTimestamps();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Track info */}
      <View style={styles.trackHeader}>
        {track.albumArt ? (
          <Image
            source={{ uri: track.albumArt }}
            style={styles.albumArt}
          />
        ) : null}
        <View style={styles.trackInfo}>
          <Text style={styles.trackName} numberOfLines={2}>
            {track.name}
          </Text>
          <Text style={styles.artistName}>{track.artists}</Text>
        </View>
      </View>

      {/* Card context */}
      <View style={styles.cardContext}>
        <Text style={styles.cardLabel}>Card:</Text>
        <Text style={styles.cardFront}>{cardFront}</Text>
        <Text style={styles.cardBack}>{cardBack}</Text>
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.openButton} onPress={openInSpotify}>
        <Text style={styles.openButtonText}>Open in Spotify</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.captureButton}
        onPress={handleAutoCapture}
      >
        <Text style={styles.captureButtonText}>Mark Timestamp</Text>
      </TouchableOpacity>

      {autoStatus ? (
        <Text style={styles.statusText}>{autoStatus}</Text>
      ) : null}

      <TouchableOpacity
        style={styles.manualLink}
        onPress={() => setShowManual(true)}
      >
        <Text style={styles.manualLinkText}>Enter time manually</Text>
      </TouchableOpacity>

      {searchField ? (
        <TouchableOpacity
          style={styles.manualLink}
          onPress={() =>
            navigation.navigate('SongCandidates', {
              cardId,
              cardFront,
              cardBack,
              searchField,
            })
          }
        >
          <Text style={styles.manualLinkText}>Search for different track</Text>
        </TouchableOpacity>
      ) : null}

      {showManual && (
        <TimestampPicker
          onSubmit={handleManualSubmit}
          onCancel={() => setShowManual(false)}
        />
      )}

      {/* Saved timestamps */}
      {timestamps.length > 0 && (
        <>
          <Text style={styles.savedTitle}>Saved Clips</Text>
          <FlatList
            data={timestamps}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.tsItem}>
                <View style={styles.tsInfo}>
                  <Text style={styles.tsTime}>
                    {formatMs(item.progress_ms)}
                  </Text>
                  {item.note ? (
                    <Text style={styles.tsNote}>{item.note}</Text>
                  ) : null}
                  <Text style={styles.tsMode}>
                    {item.capture_mode === 'auto' ? 'Auto' : 'Manual'}
                  </Text>
                </View>
                <View style={styles.tsActions}>
                  <TouchableOpacity
                    onPress={() => copyTimestamp(item.progress_ms)}
                  >
                    <Text style={styles.tsActionText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleJump(item.progress_ms)}
                  >
                    <Text style={styles.tsActionText}>Jump</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Text style={[styles.tsActionText, { color: '#e74c3c' }]}>
                      Del
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </>
      )}

      <Text style={styles.attribution}>
        Content provided by Spotify. Tap "Open in Spotify" to listen.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  trackHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  albumArt: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  trackName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  artistName: {
    color: '#b3b3b3',
    fontSize: 14,
    marginTop: 4,
  },
  cardContext: {
    backgroundColor: '#1e1e1e',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  cardLabel: {
    color: '#727272',
    fontSize: 12,
    marginBottom: 4,
  },
  cardFront: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '600',
  },
  cardBack: {
    color: '#fff',
    fontSize: 14,
    marginTop: 2,
  },
  openButton: {
    backgroundColor: '#1DB954',
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 10,
  },
  openButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  captureButton: {
    backgroundColor: '#e74c3c',
    padding: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 8,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  statusText: {
    color: '#f39c12',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  manualLink: {
    alignItems: 'center',
    marginBottom: 16,
  },
  manualLinkText: {
    color: '#b3b3b3',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  savedTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  tsItem: {
    backgroundColor: '#1e1e1e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tsInfo: {
    flex: 1,
  },
  tsTime: {
    color: '#1DB954',
    fontSize: 18,
    fontWeight: '700',
  },
  tsNote: {
    color: '#b3b3b3',
    fontSize: 13,
    marginTop: 2,
  },
  tsMode: {
    color: '#535353',
    fontSize: 11,
    marginTop: 2,
  },
  tsActions: {
    flexDirection: 'row',
    gap: 12,
  },
  tsActionText: {
    color: '#1DB954',
    fontSize: 13,
    fontWeight: '600',
  },
  attribution: {
    color: '#535353',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 12,
  },
});
