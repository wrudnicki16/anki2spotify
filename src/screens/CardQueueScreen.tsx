import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getCardsByDeck, updateDeckSearchField, getTrackForCard } from '../db/database';

interface CardRow {
  id: number;
  front: string;
  back: string;
  tags: string;
  status: string;
}

export default function CardQueueScreen({ route, navigation }: any) {
  const { deckId, deckName, searchField: initialSearchField } = route.params;
  const [cards, setCards] = useState<CardRow[]>([]);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [searchField, setSearchField] = useState<'front' | 'back'>(
    initialSearchField ?? 'back'
  );

  const [lyricsOnly, setLyricsOnly] = useState(false);

  const toggleSearchField = async () => {
    const next = searchField === 'back' ? 'front' : 'back';
    setSearchField(next);
    await updateDeckSearchField(deckId, next);
  };

  const displayedCards = lyricsOnly
    ? cards.filter((c) => {
        const text = searchField === 'front' ? c.front : c.back;
        return text.trim().split(/\s+/).length >= 3;
      })
    : cards;

  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [filter])
  );

  const loadCards = async () => {
    const c = await getCardsByDeck(deckId, filter);
    setCards(c as CardRow[]);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'matched':
        return '#1DB954';
      case 'skipped':
        return '#727272';
      default:
        return '#b3b3b3';
    }
  };

  const filters = [
    { label: 'All', value: undefined },
    { label: 'Pending', value: 'pending' },
    { label: 'Matched', value: 'matched' },
    { label: 'Skipped', value: 'skipped' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{deckName}</Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() =>
            navigation.navigate('Export', { deckId, deckName })
          }
        >
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[
              styles.filterChip,
              filter === f.value && styles.filterChipActive,
            ]}
            onPress={() => setFilter(f.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f.value && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchFieldRow}>
        <Text style={styles.searchFieldLabel}>Search by:</Text>
        <TouchableOpacity
          style={[
            styles.filterChip,
            searchField === 'front' && styles.filterChipActive,
          ]}
          onPress={toggleSearchField}
        >
          <Text
            style={[
              styles.filterChipText,
              searchField === 'front' && styles.filterChipTextActive,
            ]}
          >
            Front
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            searchField === 'back' && styles.filterChipActive,
          ]}
          onPress={toggleSearchField}
        >
          <Text
            style={[
              styles.filterChipText,
              searchField === 'back' && styles.filterChipTextActive,
            ]}
          >
            Back
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            lyricsOnly && styles.filterChipActive,
          ]}
          onPress={() => setLyricsOnly(!lyricsOnly)}
        >
          <Text
            style={[
              styles.filterChipText,
              lyricsOnly && styles.filterChipTextActive,
            ]}
          >
            Lyrics
          </Text>
        </TouchableOpacity>
      </View>

      {displayedCards.length === 0 ? (
        <Text style={styles.emptyText}>No cards to show.</Text>
      ) : (
        <FlatList
          data={displayedCards}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.cardItem}
              onPress={async () => {
                if (item.status === 'matched') {
                  const row = await getTrackForCard(item.id);
                  if (row) {
                    navigation.navigate('Capture', {
                      cardId: item.id,
                      cardFront: item.front,
                      cardBack: item.back,
                      searchField,
                      track: {
                        id: row.track_id,
                        name: row.track_name,
                        artists: row.artist_name,
                        albumArt: row.album_art,
                        spotifyUrl: row.spotify_url,
                        spotifyUri: row.spotify_uri,
                        durationMs: 0,
                      },
                    });
                    return;
                  }
                }
                navigation.navigate('SongCandidates', {
                  cardId: item.id,
                  cardFront: item.front,
                  cardBack: item.back,
                  searchField,
                });
              }}
            >
              <View style={styles.cardContent}>
                <Text style={styles.cardFront} numberOfLines={1}>
                  {item.front}
                </Text>
                <Text style={styles.cardBack} numberOfLines={1}>
                  {item.back}
                </Text>
              </View>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusColor(item.status) },
                ]}
              />
            </TouchableOpacity>
          )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
  },
  exportButton: {
    backgroundColor: '#535353',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  exportText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  searchFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  searchFieldLabel: {
    color: '#b3b3b3',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
  },
  filterChipActive: {
    backgroundColor: '#1DB954',
  },
  filterChipText: {
    color: '#b3b3b3',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  emptyText: {
    color: '#727272',
    textAlign: 'center',
    marginTop: 40,
  },
  cardItem: {
    backgroundColor: '#1e1e1e',
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardFront: {
    color: '#1DB954',
    fontSize: 15,
    fontWeight: '600',
  },
  cardBack: {
    color: '#b3b3b3',
    fontSize: 14,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
});
