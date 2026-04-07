import React, { useEffect, useState, useLayoutEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../constants/colors';
import { getManualEntryForCard, upsertManualEntry } from '../db/database';
import ManualEntryForm from '../components/ManualEntryForm';
import { ManualEntry } from '../types';

interface Props {
  route: any;
  navigation: any;
  accessToken: string | null;
}

export default function ManualEntryScreen({
  route,
  navigation,
  accessToken,
}: Props) {
  const { cardId, cardFront, cardBack, searchField } = route.params as {
    cardId: number;
    cardFront: string;
    cardBack: string;
    searchField: 'front' | 'back';
  };

  const [entry, setEntry] = useState<ManualEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const row = await getManualEntryForCard(cardId);
      setEntry(row);
      setLoading(false);
    };
    load();
  }, [cardId]);

  useLayoutEffect(() => {
    if (accessToken) {
      navigation.setOptions({
        headerRight: () => (
          <Pressable
            onPress={() =>
              navigation.replace('SongCandidates', {
                cardId,
                cardFront,
                cardBack,
                searchField,
              })
            }
            accessibilityLabel="Search Spotify"
            accessibilityRole="button"
            testID="header-spotify-btn"
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnText}>Spotify</Text>
          </Pressable>
        ),
      });
    } else {
      navigation.setOptions({ headerRight: undefined });
    }
  }, [accessToken, navigation, cardId, cardFront, cardBack, searchField]);

  const handleSave = async (data: { title: string; url: string; notes: string }) => {
    await upsertManualEntry({
      cardId,
      title: data.title,
      url: data.url,
      notes: data.notes,
    });
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cardInfo}>
        <Text style={styles.cardFront}>{cardFront}</Text>
        <Text style={styles.cardBack}>{cardBack}</Text>
      </View>

      <ManualEntryForm
        initial={
          entry
            ? { title: entry.title, url: entry.url, notes: entry.notes }
            : undefined
        }
        onSave={handleSave}
        onCancel={() => navigation.goBack()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  cardFront: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  cardBack: {
    color: colors.textPrimary,
    fontSize: 14,
    marginTop: 4,
  },
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
