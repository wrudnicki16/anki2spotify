# APKG Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to import `.apkg` files (Anki's native export format) in addition to CSV, with a deck selection step when the file contains multiple decks.

**Architecture:** `jszip` (pure JS) unzips the `.apkg` in memory and extracts the embedded SQLite database as base64. We write those bytes to the app's SQLite directory so `expo-sqlite` can open it, query notes and decks, then delete the temp file. The deck selection UI is inserted between file pick and the existing card preview step.

**Tech Stack:** `jszip` (new), `expo-file-system`, `expo-sqlite`, `expo-document-picker`, React Native

---

### Task 1: Install jszip

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

```bash
npx expo install jszip
```

**Step 2: Verify it installed**

```bash
grep jszip package.json
```

Expected output includes `"jszip": "..."` in dependencies.

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add jszip dependency for apkg parsing"
```

---

### Task 2: Create `src/utils/parseApkg.ts` — pure helper functions + tests

**Files:**
- Create: `src/utils/parseApkg.ts`
- Create: `src/utils/parseApkg.test.ts`

**Step 1: Add minimal Jest setup**

Install:
```bash
npm install --save-dev jest ts-jest @types/jest
```

Add to `package.json` scripts and jest config:
```json
"scripts": {
  "test": "jest"
},
"jest": {
  "preset": "ts-jest/presets/js-with-ts",
  "testEnvironment": "node",
  "moduleFileExtensions": ["ts", "tsx", "js"],
  "transform": {
    "^.+\\.(ts|tsx)$": "ts-jest"
  }
}
```

**Step 2: Write failing tests for the two pure functions**

Create `src/utils/parseApkg.test.ts`:
```typescript
import { stripHtml, splitFields } from './parseApkg';

describe('stripHtml', () => {
  it('removes simple tags', () => {
    expect(stripHtml('<b>hello</b>')).toBe('hello');
  });
  it('removes br tags', () => {
    expect(stripHtml('line1<br>line2')).toBe('line1line2');
  });
  it('trims whitespace', () => {
    expect(stripHtml('  <span>word</span>  ')).toBe('word');
  });
  it('returns plain text unchanged', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });
});

describe('splitFields', () => {
  it('splits on unit separator', () => {
    expect(splitFields('front\x1fback')).toEqual(['front', 'back']);
  });
  it('handles three fields', () => {
    expect(splitFields('a\x1fb\x1fc')).toEqual(['a', 'b', 'c']);
  });
  it('handles single field', () => {
    expect(splitFields('only')).toEqual(['only']);
  });
});
```

**Step 3: Run tests to confirm they fail**

```bash
npm test -- src/utils/parseApkg.test.ts
```

Expected: `Cannot find module './parseApkg'`

**Step 4: Create `src/utils/parseApkg.ts` with pure functions only**

```typescript
import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import JSZip from 'jszip';

export interface AnkiDeck {
  id: number;
  name: string;
  noteCount: number;
}

export interface ApkgCard {
  front: string;
  back: string;
  tags: string;
}

export interface ApkgResult {
  decks: AnkiDeck[];
  notesByDeck: Record<number, ApkgCard[]>;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

export function splitFields(flds: string): string[] {
  return flds.split('\x1f');
}
```

**Step 5: Run tests to confirm they pass**

```bash
npm test -- src/utils/parseApkg.test.ts
```

Expected: all 7 tests PASS.

**Step 6: Commit**

```bash
git add src/utils/parseApkg.ts src/utils/parseApkg.test.ts package.json
git commit -m "feat: add parseApkg utility with pure helper functions"
```

---

### Task 3: Add file system + SQLite integration to `parseApkg.ts`

**Files:**
- Modify: `src/utils/parseApkg.ts`

**Step 1: Add the `parseApkg` function below the pure helpers**

Append to `src/utils/parseApkg.ts`:

```typescript
const TEMP_DB_NAME = 'anki_import_tmp.db';

export async function parseApkg(fileUri: string): Promise<ApkgResult> {
  const sqliteDir = FileSystem.documentDirectory + 'SQLite/';
  const tempDbPath = sqliteDir + TEMP_DB_NAME;

  try {
    // 1. Read file as base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 2. Unzip and find the collection database
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const entry = zip.file('collection.anki21') ?? zip.file('collection.anki2');
    if (!entry) throw new Error('No collection database found in package');

    // 3. Write SQLite bytes to the app's SQLite directory
    const dbBase64 = await entry.async('base64');
    await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
    await FileSystem.writeAsStringAsync(tempDbPath, dbBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 4. Open and query
    const db = await SQLite.openDatabaseAsync(TEMP_DB_NAME);

    const colRow = await db.getFirstAsync<{ decks: string }>('SELECT decks FROM col');
    if (!colRow) throw new Error('Could not read deck information');

    const decksJson = JSON.parse(colRow.decks) as Record<
      string,
      { id: number; name: string }
    >;

    // Note counts per deck (one note may have multiple cards; COUNT DISTINCT nid)
    const countRows = await db.getAllAsync<{ did: number; note_count: number }>(
      'SELECT MIN(c.did) as did, COUNT(DISTINCT c.nid) as note_count FROM cards c GROUP BY c.did'
    );
    const countByDeck = new Map(countRows.map((r) => [r.did, r.note_count]));

    // All notes with their deck assignment
    const noteRows = await db.getAllAsync<{
      flds: string;
      tags: string;
      did: number;
    }>(
      'SELECT n.flds, n.tags, MIN(c.did) as did FROM notes n JOIN cards c ON c.nid = n.id GROUP BY n.id'
    );

    await db.closeAsync();

    // 5. Build deck list (only decks that have notes)
    const decks: AnkiDeck[] = Object.values(decksJson)
      .map((d) => ({
        id: d.id,
        name: d.name,
        noteCount: countByDeck.get(d.id) ?? 0,
      }))
      .filter((d) => d.noteCount > 0);

    // 6. Build notesByDeck
    const notesByDeck: Record<number, ApkgCard[]> = {};
    for (const row of noteRows) {
      const fields = splitFields(row.flds);
      const front = stripHtml(fields[0] ?? '');
      const back = stripHtml(fields[1] ?? '');
      if (!front && !back) continue;
      if (!notesByDeck[row.did]) notesByDeck[row.did] = [];
      notesByDeck[row.did].push({ front, back, tags: row.tags.trim() });
    }

    return { decks, notesByDeck };
  } finally {
    // Cleanup — silent failure is fine; file is overwritten next import
    await FileSystem.deleteAsync(tempDbPath, { idempotent: true }).catch(() => {});
  }
}
```

**Step 2: Manual smoke test**

- Export any small deck from Anki as `.apkg`
- In a JS REPL or via a test button, call `parseApkg(fileUri)` with the picked URI
- Confirm: `decks` array has correct names/counts, `notesByDeck` has correct front/back

**Step 3: Commit**

```bash
git add src/utils/parseApkg.ts
git commit -m "feat: implement parseApkg file system and SQLite integration"
```

---

### Task 4: Update `DeckImportScreen` — state and file picker

**Files:**
- Modify: `src/screens/DeckImportScreen.tsx`

**Step 1: Add imports at the top**

Add to existing imports:
```typescript
import { parseApkg, ApkgResult, AnkiDeck } from '../utils/parseApkg';
```

**Step 2: Add new state variables** inside `DeckImportScreen` after the existing state declarations:

```typescript
const [apkgResult, setApkgResult] = useState<ApkgResult | null>(null);
const [selectedDeckIds, setSelectedDeckIds] = useState<number[]>([]);
const [apkgDeckCards, setApkgDeckCards] = useState<
  Array<{ deckName: string; cards: { front: string; back: string; tags: string }[] }>
>([]);
```

**Step 3: Replace `pickCSV` with `pickFile`**

Remove the existing `pickCSV` function and replace with:

```typescript
const pickFile = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const file = result.assets[0];
    setFileName(file.name);

    if (file.name.toLowerCase().endsWith('.apkg')) {
      setLoading(true);
      try {
        const parsed = await parseApkg(file.uri);
        if (parsed.decks.length === 0) {
          Alert.alert('No cards found', 'No cards found in the selected decks.');
          return;
        }
        setApkgResult(parsed);
        setSelectedDeckIds(parsed.decks.map((d) => d.id));
      } catch {
        Alert.alert('Error', 'Could not read this file. Make sure it\'s a valid .apkg export from Anki.');
      } finally {
        setLoading(false);
      }
    } else {
      const fsFile = new File(file.uri);
      const content = await fsFile.text();
      const cards = parseCSV(content);
      setPreview(cards);
    }
  } catch {
    Alert.alert('Error', 'Failed to read file');
  }
};
```

**Step 4: Update the "Import Deck" button's `onPress`**

Change `onPress={pickCSV}` → `onPress={pickFile}`.

**Step 5: Update Cancel button in preview step to also clear APKG state**

Find the Cancel button's `onPress`:
```typescript
onPress={() => {
  setPreview([]);
  setFileName('');
}}
```
Replace with:
```typescript
onPress={() => {
  setPreview([]);
  setFileName('');
  setApkgDeckCards([]);
}}
```

**Step 6: Commit**

```bash
git add src/screens/DeckImportScreen.tsx
git commit -m "feat: wire up apkg file detection and state in DeckImportScreen"
```

---

### Task 5: Add deck selection UI to `DeckImportScreen`

**Files:**
- Modify: `src/screens/DeckImportScreen.tsx`

**Step 1: Add toggle helper inside the component**

```typescript
const toggleDeck = (id: number) => {
  setSelectedDeckIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );
};
```

**Step 2: Add the deck selection confirm handler**

```typescript
const confirmDeckSelection = () => {
  if (!apkgResult) return;
  if (selectedDeckIds.length === 0) {
    Alert.alert('Select at least one deck');
    return;
  }
  const selectedDecks = apkgResult.decks.filter((d) =>
    selectedDeckIds.includes(d.id)
  );
  const deckCards = selectedDecks.map((d) => ({
    deckName: d.name,
    cards: apkgResult.notesByDeck[d.id] ?? [],
  }));
  const allCards = deckCards.flatMap((d) => d.cards);
  if (allCards.length === 0) {
    Alert.alert('No cards found', 'No cards found in the selected decks.');
    return;
  }
  setApkgDeckCards(deckCards);
  setPreview(allCards);
  setApkgResult(null);
};
```

**Step 3: Add deck selection render block**

In the JSX, the current structure is:
```
{preview.length === 0 ? (main screen) : (preview screen)}
```

Change to a three-way branch:
```typescript
{preview.length === 0 && !apkgResult ? (
  <>
    {/* existing main screen — Import Deck button + deck list */}
  </>
) : apkgResult ? (
  <>
    <Text style={styles.sectionTitle}>
      Select Decks to Import
    </Text>
    <FlatList
      data={apkgResult.decks}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.deckSelectRow}
          onPress={() => toggleDeck(item.id)}
        >
          <View
            style={[
              styles.checkbox,
              selectedDeckIds.includes(item.id) && styles.checkboxSelected,
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.deckName}>{item.name}</Text>
            <Text style={styles.deckInfo}>{item.noteCount} cards</Text>
          </View>
        </TouchableOpacity>
      )}
    />
    <View style={styles.previewActions}>
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => {
          setApkgResult(null);
          setSelectedDeckIds([]);
          setFileName('');
        }}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.confirmButton}
        onPress={confirmDeckSelection}
      >
        <Text style={styles.confirmText}>
          Import {selectedDeckIds.length} deck{selectedDeckIds.length !== 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>
    </View>
  </>
) : (
  <>
    {/* existing preview screen — unchanged */}
  </>
)}
```

**Step 4: Add styles for deck selection**

Add to `StyleSheet.create({...})`:

```typescript
deckSelectRow: {
  backgroundColor: '#1e1e1e',
  padding: 14,
  borderRadius: 10,
  marginBottom: 6,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
checkbox: {
  width: 20,
  height: 20,
  borderRadius: 4,
  borderWidth: 2,
  borderColor: '#535353',
  backgroundColor: 'transparent',
},
checkboxSelected: {
  backgroundColor: '#1DB954',
  borderColor: '#1DB954',
},
```

**Step 5: Manual test — deck selection UI**

- Pick a multi-deck `.apkg` file
- Confirm deck list renders with all checked by default
- Uncheck one deck, tap Import — confirm only the selected deck appears in preview
- Tap Cancel — confirm you return to the main screen

**Step 6: Commit**

```bash
git add src/screens/DeckImportScreen.tsx
git commit -m "feat: add deck selection UI for apkg import"
```

---

### Task 6: Update `confirmImport` to handle multiple APKG decks

**Files:**
- Modify: `src/screens/DeckImportScreen.tsx`

**Step 1: Update `confirmImport`**

Replace the existing `confirmImport` function:

```typescript
const confirmImport = async () => {
  if (preview.length === 0) return;
  setLoading(true);
  try {
    if (apkgDeckCards.length > 0) {
      // APKG import: one deck per Anki deck
      let totalCards = 0;
      for (const { deckName, cards } of apkgDeckCards) {
        const deckId = await insertDeck(deckName);
        await insertCards(deckId, cards);
        totalCards += cards.length;
      }
      const deckWord = apkgDeckCards.length === 1 ? 'deck' : 'decks';
      Alert.alert(
        'Success',
        `Imported ${totalCards} cards across ${apkgDeckCards.length} ${deckWord}`
      );
    } else {
      // CSV import: existing behavior
      const deckName =
        fileName.replace(/\.(csv|txt)$/i, '') || 'Imported Deck';
      const deckId = await insertDeck(deckName);
      await insertCards(deckId, preview);
      Alert.alert('Success', `Imported ${preview.length} cards into "${deckName}"`);
    }
    setPreview([]);
    setFileName('');
    setApkgDeckCards([]);
    await loadDecks();
  } catch {
    Alert.alert('Error', 'Failed to import deck');
  } finally {
    setLoading(false);
  }
};
```

**Step 2: Manual end-to-end test**

- Pick a `.apkg` with 2+ decks
- Select both decks → confirm → verify two deck entries appear in Your Decks with correct card counts
- Pick a `.apkg`, select only one deck → confirm → verify only one deck appears
- Pick a `.csv` → confirm existing CSV flow still works unchanged

**Step 3: Commit**

```bash
git add src/screens/DeckImportScreen.tsx
git commit -m "feat: complete apkg import flow with multi-deck support"
```
