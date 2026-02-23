# APKG Import — Design

**Date:** 2026-02-23
**Status:** Approved

---

## Problem

The app currently only accepts Anki decks exported as CSV. Anki's native export format is `.apkg`, a ZIP file containing a SQLite database (`collection.anki2`). Requiring CSV export adds friction — most Anki users never export to CSV and the option is buried in the UI.

---

## Approach

**jszip + expo-sqlite temp database** (pure JS, managed Expo compatible)

1. User picks an `.apkg` file via `DocumentPicker`
2. `jszip` loads the file bytes and extracts `collection.anki2` as a `Uint8Array`
3. Those bytes are written to `<documentDirectory>/SQLite/anki_import_tmp.db` via `expo-file-system`
4. `expo-sqlite` opens the temp database, queries decks and notes, then the DB is closed and deleted
5. User selects which decks to import (all checked by default)
6. Existing card preview and confirm flow runs as today

**New dependency:** `jszip` (pure JavaScript, no native modules required)

---

## Data Pipeline

### Deck list
Parse `col.decks` JSON (one row in the `col` table) → `{ [deck_id]: { name, id } }` → array of `{ id, name, noteCount }`.

Note count is derived by counting distinct note IDs with a card in each deck:
```sql
SELECT c.did, COUNT(DISTINCT c.nid) as count
FROM cards c
GROUP BY c.did
```

### Cards per deck
```sql
SELECT n.id, n.flds, n.tags, c.did
FROM notes n
JOIN cards c ON c.nid = n.id
GROUP BY n.id
```

From each note row:
- Split `flds` on `\x1f` (char code 31)
- `flds[0]` → Front (strip HTML)
- `flds[1]` → Back (strip HTML)
- `tags` (space-separated string) → tags field

HTML stripping: replace all `<[^>]+>` matches with empty string.

### Temp DB cleanup
Close the expo-sqlite connection, then delete `anki_import_tmp.db`. Cleanup failure is silent — the file gets overwritten on next import.

---

## UI Flow

### File pick
Single **"Import Deck"** button accepts both `.csv`/`.txt` and `.apkg`. File type detected by extension after picking. CSV flow is unchanged.

### APKG-only: deck selection step
Inserted between file pick and existing card preview:

- List of all decks in the file, each row shows deck name + card count
- Checkbox per deck, all checked by default
- "Import N decks" confirm button

### Card preview (existing, unchanged)
Runs after deck selection is confirmed. Shows up to 20 cards from the merged set across selected decks. Existing Confirm/Cancel buttons.

### Confirm import
One deck entry is created per selected Anki deck. Cards are inserted per deck as today.

---

## Error Handling

| Failure | Behavior |
|---|---|
| Unzip fails / invalid file | Alert: "Could not read this file. Make sure it's a valid .apkg export from Anki." |
| No notes found in selected decks | Alert: "No cards found in the selected decks." |
| Temp DB cleanup fails | Silent — file is overwritten on next import |

No partial-import recovery. On failure, user picks the file again.

---

## Files to Modify / Create

- `src/utils/parseApkg.ts` — new: all APKG parsing logic (unzip, query, cleanup)
- `src/screens/DeckImportScreen.tsx` — add APKG file handling and deck selection UI
- `package.json` — add `jszip` dependency
