import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSpotify } from '../hooks/useSpotify';
import TrackCard from '../components/TrackCard';
import { SpotifyTrack } from '../types';
import { getTracksWithClipsForCard } from '../db/database';

interface Props {
  route: any;
  navigation: any;
  accessToken: string | null;
}

export default function SongCandidatesScreen({
  route,
  navigation,
  accessToken,
}: Props) {
  const { cardId, cardFront, cardBack, searchField } = route.params;
  const { searchTracks } = useSpotify(accessToken);
  const initialQuery = searchField === 'front' ? cardFront : cardBack;
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tracksWithClips, setTracksWithClips] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (accessToken && initialQuery) {
      doSearch(initialQuery);
    }
  }, [accessToken]);

  useEffect(() => {
    getTracksWithClipsForCard(cardId).then((rows) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        map.set(row.track_id, row.clip_count);
      }
      setTracksWithClips(map);
    });
  }, [cardId]);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    const tracks = await searchTracks(q.trim());
    setResults(tracks);
    setLoading(false);
  };

  const handleSelect = (track: SpotifyTrack) => {
    navigation.navigate('Capture', {
      cardId,
      cardFront,
      cardBack,
      track: {
        id: track.id,
        name: track.name,
        artists: track.artists.map((a) => a.name).join(', '),
        albumArt:
          track.album.images[1]?.url ?? track.album.images[0]?.url ?? '',
        spotifyUrl: track.external_urls.spotify,
        spotifyUri: track.uri,
        durationMs: track.duration_ms,
      },
    });
  };

  if (!accessToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.authMessage}>
          Please log in with Spotify to search for songs.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cardInfo}>
        <Text style={styles.cardFront}>{cardFront}</Text>
        <Text style={styles.cardBack}>{cardBack}</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search Spotify..."
          placeholderTextColor="#666"
          onSubmitEditing={() => doSearch(query)}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#1DB954"
          style={{ marginTop: 40 }}
        />
      ) : results.length === 0 && searched ? (
        <Text style={styles.noResults}>
          No tracks found. Try a different search.
        </Text>
      ) : (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  cardInfo: {
    backgroundColor: '#1e1e1e',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  cardFront: {
    color: '#1DB954',
    fontSize: 16,
    fontWeight: '700',
  },
  cardBack: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
  },
  searchRow: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
  },
  authMessage: {
    color: '#b3b3b3',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 60,
  },
  noResults: {
    color: '#727272',
    textAlign: 'center',
    marginTop: 40,
  },
});
